"""
app/services/analytics_service.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Orchestration layer for the Analytics module.

Responsibilities
────────────────
• Resolve the timeframe window (date bounds, granularity, trend anchor).
• Fetch all required data concurrently via two asyncio.gather() rounds.
• Pass raw data to scoring_service for pure-math computations.
• Assemble and return the validated AnalyticsOverviewResponse.

What this file does NOT do
──────────────────────────
• Database mutations (those belong to wallet_service / savings_targets_service).
• Mathematical scoring (belongs to scoring_service).
• Schema validation (Pydantic handles this on return).

Two-round gather strategy
─────────────────────────
Round 1 — time-independent data:
    player_access, wallet_snapshot, active_baseline, savings_targets,
    monthly_debt_payments, avg_monthly_debt_payments,
    current_month_variable_spending, earliest_transaction_date

Round 2 — timeframe-resolved data (depends on Round 1 output):
    cashflow_series, category_breakdown, top_transactions,
    historical_stability_score

This structure avoids waterfall sequencing while respecting the dependency
on earliest_transaction_date for the 'all' timeframe.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import date, timedelta
from datetime import datetime, timezone
from uuid import UUID

import asyncpg

from app.db.queries import analytics_queries, savings_targets_queries
from app.schemas.analytics import (
    Advisory,
    AnalyticsOverviewResponse,
    AssetHealth,
    Cashflow,
    CashflowDataPoint,
    CategoryBreakdown,
    CategoryBreakdownItem,
    DebtHealth,
    DebtStatus,
    FinancialStability,
    Granularity,
    IncomeAllocation,
    SavingsTargetSummary,
    SuggestedAction,
    Timeframe,
    TopTransaction,
    UnlockStatus,
    AdvisoryPriority,
)
from app.services import scoring_service
from app.services.scoring_service import CategoryInput

# ── Constants ─────────────────────────────────────────────────────────────────

_ANALYTICS_REQUIRED_LEVEL: int = 3
_ANALYTICS_VERSION: int = 1
_SCORE_VERSION: int = 1
_ALL_TIMEFRAME_MAX_YEARS: int = 5
_DEFAULT_TIMEZONE: str = "UTC+7"

# ── Internal DTOs ─────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class _TimeframeWindow:
    """Resolved date bounds and metadata for a single analytics request."""
    timeframe: Timeframe
    start: date
    end: date
    granularity: Granularity
    # Anchor date for historical score lookup; may be before the user's join date.
    trend_anchor: date


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PUBLIC API
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def get_overview_payload(
    db: asyncpg.Connection,
    *,
    user_id: UUID,
    timeframe_str: str,
    user_tz: str,
) -> AnalyticsOverviewResponse:
    """
    Assemble the full analytics overview payload for the given user and
    timeframe.

    Raises ValueError with message "invalid_timeframe" when timeframe_str
    is not one of: 1w, 1m, 1y, all.
    The endpoint layer maps this to the standard error JSON.

    Args:
        db:            Active asyncpg connection (injected by the endpoint).
        user_id:       Authenticated user UUID.
        timeframe_str: Raw query parameter string (e.g. "1m").
        user_tz:       User timezone string from profile.timezone.
                       Falls back to _DEFAULT_TIMEZONE if empty or invalid.
    """
    # Validate timeframe before touching the database.
    try:
        timeframe = Timeframe(timeframe_str)
    except ValueError:
        raise ValueError("invalid_timeframe")

    tz = user_tz or _DEFAULT_TIMEZONE
    today = date.today()  # local date; timezone offset handled in SQL layer

    # ── Round 1: time-independent fetches ─────────────────────────────────────
    (
        player_access,
        wallet_snapshot,
        baseline,
        savings_targets,
        monthly_debt,
        avg_debt_payment,
        variable_spending,
        earliest_tx_date,
    ) = await asyncio.gather(
        analytics_queries.get_player_access(db, user_id=user_id),
        analytics_queries.get_wallet_snapshot(db, user_id=user_id),
        analytics_queries.get_active_baseline(db, user_id=user_id),
        savings_targets_queries.get_active_savings_targets(db, user_id=user_id),
        analytics_queries.get_monthly_debt_payments(db, user_id=user_id, month_date=today),
        analytics_queries.get_avg_monthly_debt_payments(db, user_id=user_id),
        _get_current_month_variable_spending(db, user_id=user_id, today=today),
        _get_earliest_transaction_date(db, user_id=user_id),
    )

    # Resolve timeframe bounds using earliest_tx_date for the 'all' window.
    window = _resolve_timeframe(timeframe, today, earliest_tx_date)

    # ── Round 2: timeframe-resolved fetches ───────────────────────────────────
    (
        cashflow_series,
        category_breakdown,
        top_transactions,
        historical_score,
    ) = await asyncio.gather(
        analytics_queries.get_cashflow_series(
            db,
            user_id=user_id,
            start_date=window.start,
            end_date=window.end,
            granularity=window.granularity,
            user_tz=tz,
        ),
        analytics_queries.get_category_breakdown(
            db,
            user_id=user_id,
            start_date=window.start,
            end_date=window.end,
        ),
        analytics_queries.get_top_transactions(
            db,
            user_id=user_id,
            start_date=window.start,
            end_date=window.end,
        ),
        analytics_queries.get_historical_stability_score(
            db,
            user_id=user_id,
            target_date=window.trend_anchor,
        ),
    )

    # ── Derived values used by multiple sections ───────────────────────────────
    monthly_income = int(baseline["income"]) if baseline else 0
    baseline_costs = int(baseline["fixed_costs"]) if baseline else 0
    liquid_cash = int(wallet_snapshot["liquid_cash"])
    remaining_debt = int(wallet_snapshot["remaining_debt"])

    dti_pct = _calculate_dti(monthly_debt, monthly_income)
    runway_months = _calculate_runway(liquid_cash, baseline_costs)

    # Build CategoryInput objects — used by both scoring and advisory.
    categories_in = _build_category_inputs(category_breakdown)

    # ── scoring_service calls (pure math, no DB) ───────────────────────────────
    stability = scoring_service.calculate_financial_stability(
        total_income_in_window=sum(int(r["income"]) for r in cashflow_series),
        total_expense_in_window=sum(int(r["expense"]) for r in cashflow_series),
        dti_pct=dti_pct,
        runway_months=runway_months,
        categories=categories_in,
    )

    # Savings target evaluation — takes the earliest deadline target (index 0).
    priority_target = savings_targets[0] if savings_targets else None
    is_behind = False
    if priority_target:
        target_amount = int(priority_target["target_amount"])
        current_amount = int(priority_target["current_amount"])
        actual_pct = (current_amount / target_amount * 100.0) if target_amount > 0 else 0.0
        created_at: date = priority_target["created_at"].date()
        deadline: date = priority_target["deadline"]
        total_days = (deadline - created_at).days
        days_elapsed = (today - created_at).days
        is_behind = scoring_service.is_savings_behind_schedule(
            actual_progress_pct=actual_pct,
            days_elapsed=days_elapsed,
            total_days=total_days,
        )

    advisory_result = scoring_service.determine_advisory_priority(
        dti_pct=dti_pct,
        liquid_cash=liquid_cash,
        baseline_costs=baseline_costs,
        categories=categories_in,
        is_savings_target_behind=is_behind,
    )

    debt_projection = scoring_service.calculate_debt_free_date(
        remaining_debt=remaining_debt,
        avg_monthly_payment=avg_debt_payment,
    )

    score_trend = scoring_service.calculate_score_trend(
        current_score=stability.total,
        historical_score=historical_score,
    )

    # Cashflow trend percentage: compare total net in current window vs prior.
    # For simplicity, compare total expense across periods using the score anchor.
    current_total_expense = sum(int(r["expense"]) for r in cashflow_series)
    current_total_income = sum(int(r["income"]) for r in cashflow_series)
    # Use income as the trend base (positive when income grew relative to expense).
    current_net = current_total_income - current_total_expense
    # We don't have the prior period raw totals here without an extra query;
    # derive a directional trend from the score delta as a proxy when no
    # prior period data is available. The proper prior-period total would
    # require a second cashflow_series query for the trend window — this is
    # a deliberate trade-off to stay within two gather() rounds.
    # For now, cashflow trend_percentage maps score_trend to a rough percentage.
    cashflow_trend_pct: float | None = None
    if historical_score is not None and historical_score > 0:
        cashflow_trend_pct = scoring_service.calculate_trend_percentage(
            current_period=stability.total,
            previous_period=historical_score,
        )

    # ── Assemble Pydantic schema models ───────────────────────────────────────
    unlock = _build_unlock_status(player_access)

    return AnalyticsOverviewResponse(
        analytics_version=_ANALYTICS_VERSION,
        generated_at=datetime.now(tz=timezone.utc),
        timeframe=timeframe,
        unlock_status=UnlockStatus(**unlock),
        financial_stability=FinancialStability(
            score=stability.total,
            score_version=_SCORE_VERSION,
            score_trend=score_trend,
            explanation=stability.explanation,
        ),
        advisory=Advisory(
            priority=AdvisoryPriority(advisory_result.priority),
            headline=advisory_result.headline,
            recommendation=advisory_result.recommendation,
            suggested_actions=[
                SuggestedAction(
                    category_id=a.category_id,
                    category_name=a.category_name,
                    reduction_amount=a.reduction_amount,
                )
                for a in advisory_result.suggested_actions
            ],
        ),
        cashflow=Cashflow(
            has_data=any(
                int(r["income"]) > 0 or int(r["expense"]) > 0
                for r in cashflow_series
            ),
            granularity=window.granularity,
            trend_percentage=cashflow_trend_pct,
            series=[
                CashflowDataPoint(
                    label=r["label"],
                    income=int(r["income"]),
                    expense=int(r["expense"]),
                )
                for r in cashflow_series
            ],
        ),
        income_allocation=_build_income_allocation(baseline, variable_spending),
        category_breakdown=_build_category_breakdown(category_breakdown),
        top_transactions=[
            TopTransaction(
                id=r["id"],
                amount=int(r["amount"]),
                category_name=r["category_name"],
                wallet_name=r["wallet_name"],
                transaction_date=r["transaction_date"],
                note=r["note"],
            )
            for r in top_transactions
        ],
        debt_health=_build_debt_health(
            wallet_snapshot=wallet_snapshot,
            monthly_income=monthly_income,
            monthly_debt=monthly_debt,
            dti_pct=dti_pct,
            debt_projection=debt_projection,
        ),
        asset_health=_build_asset_health(
            wallet_snapshot=wallet_snapshot,
            baseline_costs=baseline_costs,
            runway_months=runway_months,
            priority_target=priority_target,
            actual_progress_pct=actual_pct if priority_target else 0.0,
            is_behind=is_behind,
        ),
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TIMEFRAME RESOLUTION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def _resolve_timeframe(
    timeframe: Timeframe,
    today: date,
    earliest_tx_date: date | None,
) -> _TimeframeWindow:
    """
    Translate the validated Timeframe enum into concrete date bounds,
    granularity, and a trend anchor date for the historical score lookup.

    Timeframe definitions (analytics_backend.md):
        1w  → today − 6 days  (7 days total, daily granularity)
              trend anchor: today − 7 days
        1m  → today − 29 days (30 days total, daily granularity)
              trend anchor: today − 30 days
        1y  → today − 364 days (365 days total, monthly granularity)
              trend anchor: today − 365 days
        all → max(earliest_tx, today − 5 years) → today, monthly granularity
              trend anchor: start − 30 days (the month before the window)

    The 5-year lookback cap for 'all' protects database resources.
    """
    if timeframe == Timeframe.ONE_WEEK:
        return _TimeframeWindow(
            timeframe=timeframe,
            start=today - timedelta(days=6),
            end=today,
            granularity=Granularity.DAILY,
            trend_anchor=today - timedelta(days=7),
        )

    if timeframe == Timeframe.ONE_MONTH:
        return _TimeframeWindow(
            timeframe=timeframe,
            start=today - timedelta(days=29),
            end=today,
            granularity=Granularity.DAILY,
            trend_anchor=today - timedelta(days=30),
        )

    if timeframe == Timeframe.ONE_YEAR:
        return _TimeframeWindow(
            timeframe=timeframe,
            start=today - timedelta(days=364),
            end=today,
            granularity=Granularity.MONTHLY,
            trend_anchor=today - timedelta(days=365),
        )

    # Timeframe.ALL
    five_years_ago = today - timedelta(days=_ALL_TIMEFRAME_MAX_YEARS * 365)
    if earliest_tx_date:
        start = max(earliest_tx_date, five_years_ago)
    else:
        # No transactions at all — window degenerates to today only.
        start = today
    trend_anchor = start - timedelta(days=30)  # the month preceding the window

    return _TimeframeWindow(
        timeframe=timeframe,
        start=start,
        end=today,
        granularity=Granularity.MONTHLY,
        trend_anchor=trend_anchor,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION BUILDERS  (asyncpg Record → Pydantic-ready dict / model)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def _build_unlock_status(player_access: asyncpg.Record) -> dict:
    current_level = int(player_access["current_level"])
    unlocked = current_level >= _ANALYTICS_REQUIRED_LEVEL

    if unlocked:
        xp_remaining = 0
    else:
        # XP needed to reach the required level:
        # level = floor(sqrt(xp / 100)) + 1  →  xp = (level - 1)² × 100
        xp_at_required = (_ANALYTICS_REQUIRED_LEVEL - 1) ** 2 * 100
        xp_remaining = max(0, xp_at_required - int(player_access["total_xp"]))

    return {
        "unlocked": unlocked,
        "required_level": _ANALYTICS_REQUIRED_LEVEL,
        "current_level": current_level,
        "xp_remaining": xp_remaining,
    }


def _build_income_allocation(
    baseline: asyncpg.Record | None,
    variable_spending: int,
) -> IncomeAllocation:
    """
    Build the income waterfall section.

    When no baseline exists, returns has_income=False with all values as 0,
    per analytics_backend.md § Execution Limits.

    variable_spending is the current-month expense total from all non-fixed
    transactions, pre-fetched by _get_current_month_variable_spending().
    """
    if not baseline:
        return IncomeAllocation(
            has_income=False,
            total_income=0,
            baseline_costs=0,
            variable_spending=0,
            remaining_amount=0,
        )

    total_income = int(baseline["income"])
    baseline_costs = int(baseline["fixed_costs"])
    # remaining_amount may be negative if spending exceeds income.
    remaining = total_income - baseline_costs - variable_spending

    return IncomeAllocation(
        has_income=total_income > 0,
        total_income=total_income,
        baseline_costs=baseline_costs,
        variable_spending=variable_spending,
        remaining_amount=remaining,
    )


def _build_category_breakdown(
    records: list[asyncpg.Record],
) -> CategoryBreakdown:
    """
    Map the query layer's per-category records to the schema model.

    Percentage calculation (analytics_backend.md):
        percentage = (spent / monthly_limit) * 100
        is_overspent = percentage > 110

    The "Other" row (is_other=True, category_id=None) is included as-is;
    its category_id is None and percentage is omitted (monthly_limit is None).
    """
    items = []
    has_data = False

    for r in records:
        spent = int(r["spent"])
        monthly_limit = int(r["monthly_limit"]) if r["monthly_limit"] is not None else None
        is_other = bool(r["is_other"])

        if spent > 0:
            has_data = True

        if is_other or monthly_limit is None or monthly_limit <= 0:
            pct = 0.0
            is_overspent = False
        else:
            pct = round((spent / monthly_limit) * 100.0, 1)
            is_overspent = pct > 110.0

        # category_id is None for the synthetic "Other" row.
        cat_id = r["category_id"]

        items.append(
            CategoryBreakdownItem(
                category_id=cat_id,
                name=r["name"],
                spent=spent,
                percentage=pct,
                is_overspent=is_overspent,
            )
        )

    return CategoryBreakdown(has_category_data=has_data, categories=items)


def _build_debt_health(
    *,
    wallet_snapshot: asyncpg.Record,
    monthly_income: int,
    monthly_debt: int,
    dti_pct: float,
    debt_projection: scoring_service.DebtFreeProjection,
) -> DebtHealth:
    """
    Assemble the debt_health section of the payload.

    safe_loan_limit: maximum additional monthly debt payment before breaching
    the 35 % DTI threshold.
        safe_loan_limit = (monthly_income × 0.35) - monthly_debt_payments
    Clamped to 0 when already over threshold.
    """
    active_loans = int(wallet_snapshot["active_loans"])

    safe_limit_f = monthly_income * (_DTI_CRITICAL / 100.0) - monthly_debt
    safe_loan_limit = max(0, round(safe_limit_f))

    if dti_pct > 30.0:
        status = DebtStatus.CRITICAL
    elif dti_pct > 20.0:
        status = DebtStatus.WARNING
    else:
        status = DebtStatus.GOOD

    return DebtHealth(
        dti_percentage=round(dti_pct, 1),
        status=status,
        active_loans=active_loans,
        safe_loan_limit=safe_loan_limit,
        debt_free_date=debt_projection.debt_free_date,
        debt_free_date_reason=debt_projection.debt_free_date_reason,
    )


def _build_asset_health(
    *,
    wallet_snapshot: asyncpg.Record,
    baseline_costs: int,
    runway_months: float | None,
    priority_target: asyncpg.Record | None,
    actual_progress_pct: float,
    is_behind: bool,
) -> AssetHealth:
    """Assemble the asset_health section of the payload."""
    liquid_cash = int(wallet_snapshot["liquid_cash"])
    net_liquid_cash = int(wallet_snapshot["net_liquid_cash"])
    invested_assets = int(wallet_snapshot["invested_assets"])

    if priority_target:
        target_amount = int(priority_target["target_amount"])
        current_amount = int(priority_target["current_amount"])
        savings_summary = SavingsTargetSummary(
            has_savings_target=True,
            target_name=priority_target["name"],
            target_amount=target_amount,
            current_amount=current_amount,
            progress_percentage=round(actual_progress_pct, 1),
            deadline=priority_target["deadline"],
            is_behind_schedule=is_behind,
        )
    else:
        savings_summary = SavingsTargetSummary(has_savings_target=False)

    return AssetHealth(
        liquid_cash=liquid_cash,
        net_liquid_cash=net_liquid_cash,
        invested_assets=invested_assets,
        has_investments=invested_assets > 0,
        survival_runway_months=round(runway_months, 2) if runway_months is not None else None,
        savings_target=savings_summary,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DERIVED METRIC HELPERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

_DTI_CRITICAL = 35.0  # mirrors scoring_service constant — kept local to avoid cross-import


def _calculate_dti(monthly_debt: int, monthly_income: int) -> float:
    """
    DTI = (monthly_debt_payments / monthly_income) × 100.
    Returns 0.0 when monthly_income == 0 (no baseline configured).
    """
    if monthly_income <= 0:
        return 0.0
    return round((monthly_debt / monthly_income) * 100.0, 2)


def _calculate_runway(liquid_cash: int, baseline_costs: int) -> float | None:
    """
    survival_runway_months = liquid_cash / (baseline_costs)
    Returns None when baseline_costs == 0 (cannot compute without fixed costs).
    Runway in full months (not days), rounded to 2dp.
    """
    if baseline_costs <= 0:
        return None
    return round(liquid_cash / baseline_costs, 2)


def _build_category_inputs(
    records: list[asyncpg.Record],
) -> list[CategoryInput]:
    """Convert asyncpg Records from get_category_breakdown into CategoryInput DTOs."""
    return [
        CategoryInput(
            category_id=r["category_id"],
            name=r["name"],
            spent=int(r["spent"]),
            monthly_limit=int(r["monthly_limit"]) if r["monthly_limit"] is not None else None,
            is_other=bool(r["is_other"]),
        )
        for r in records
    ]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# INLINE DB HELPERS
# These are simple one-shot queries that don't justify their own query module
# function. They are private to this service. If the query module grows, they
# can be promoted to analytics_queries.py without interface changes.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def _get_earliest_transaction_date(
    db: asyncpg.Connection,
    *,
    user_id: UUID,
) -> date | None:
    """
    Fetch the earliest transaction_date for this user.
    Used to resolve the start bound of the 'all' timeframe.
    Returns None when the user has no transactions yet.
    """
    row = await db.fetchrow(
        """
        SELECT MIN(transaction_date)::date AS earliest
        FROM   transactions
        WHERE  user_id = $1 AND deleted_at IS NULL
        """,
        user_id,
    )
    return row["earliest"] if row and row["earliest"] else None


async def _get_current_month_variable_spending(
    db: asyncpg.Connection,
    *,
    user_id: UUID,
    today: date,
) -> int:
    """
    Sum all expense transactions in the current calendar month.

    Used for income_allocation.variable_spending — this is always a
    current-month figure regardless of the analytics timeframe window.
    Returns 0 when there are no expense transactions this month.
    """
    row = await db.fetchrow(
        """
        SELECT COALESCE(SUM(amount), 0)::bigint AS total
        FROM   transactions
        WHERE
            user_id          = $1
            AND type         = 'expense'
            AND deleted_at   IS NULL
            AND DATE_TRUNC('month', transaction_date)
                = DATE_TRUNC('month', $2::date)
        """,
        user_id,
        today,
    )
    return int(row["total"]) if row else 0

"""
app/services/scoring_service.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pure mathematical scoring engine for the Analytics module.

Contract
────────
• ZERO database calls — all inputs are pre-fetched by analytics_service.
• ZERO Pydantic schema imports — outputs are dataclasses / plain dicts so
  this module stays importable in isolation (e.g. unit tests, CLI tools).
• The analytics_service owns the mapping from these dataclasses to schemas.

Public surface
──────────────
  calculate_financial_stability(...)  → StabilityScore
  determine_advisory_priority(...)    → AdvisoryResult
  calculate_debt_free_date(...)       → DebtFreeProjection
  is_savings_behind_schedule(...)     → bool
  calculate_trend_percentage(...)     → float | None
  calculate_score_trend(...)          → int
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from uuid import UUID

# ── Scoring thresholds & weights ──────────────────────────────────────────────

# Component max points — must sum to 100.
_CASHFLOW_MAX_PTS: int = 30
_DEBT_MAX_PTS: int = 30
_RUNWAY_MAX_PTS: int = 20
_DISCIPLINE_MAX_PTS: int = 20

# Cashflow scoring band: net_ratio = (income − expense) / income
# net_ratio ≥ EXCELLENT → full marks; ≤ FLOOR → 0 marks; linear between.
_CASHFLOW_EXCELLENT_RATIO: float = 0.30   # saving 30 %+ of income
_CASHFLOW_FLOOR_RATIO: float = -0.50      # spending 150 %+ of income

# DTI: 0 % → 30 pts  |  ≥ 35 % → 0 pts  (linear, clamped)
_DTI_CRITICAL_PCT: float = 35.0

# Runway: 0 months → 0 pts  |  ≥ 6 months → 20 pts  (linear, clamped)
_RUNWAY_EXCELLENT_MONTHS: float = 6.0

# Spend discipline: each overspent category costs _DISCIPLINE_COST_PER_OVERSPEND pts.
# 3 overspent categories → 0 pts.
_DISCIPLINE_COST_PER_OVERSPEND: float = _DISCIPLINE_MAX_PTS / 3

# Advisory cascade thresholds
_DTI_CRITICAL_THRESHOLD: float = 35.0      # Level 1: critical_debt
_OVERSPEND_ADVISORY_PCT: float = 110.0     # Level 3: overspending at > 110 %


# ── Internal data-transfer objects ───────────────────────────────────────────


@dataclass(frozen=True)
class StabilityScore:
    """Output of calculate_financial_stability."""
    total: int                 # 0-100, clamped
    cashflow_pts: int          # 0-30
    debt_pts: int              # 0-30
    runway_pts: int            # 0-20
    discipline_pts: int        # 0-20
    explanation: str


@dataclass(frozen=True)
class SuggestedAction:
    """One line-item inside an overspending advisory."""
    category_id: UUID
    category_name: str
    reduction_amount: int      # IDR — how much to cut to return to 100 % of limit


@dataclass(frozen=True)
class AdvisoryResult:
    """Output of determine_advisory_priority."""
    priority: str              # matches AdvisoryPriority enum string values
    headline: str
    recommendation: str
    suggested_actions: list[SuggestedAction] = field(default_factory=list)


@dataclass(frozen=True)
class DebtFreeProjection:
    """Output of calculate_debt_free_date."""
    debt_free_date: date | None
    debt_free_date_reason: str | None     # populated only when date is None


@dataclass(frozen=True)
class CategoryInput:
    """
    Flattened per-category data expected by the scoring functions.
    The analytics_service maps raw query Records into these before calling
    any scoring function — keeping this module free of all DB dependencies.
    """
    category_id: UUID
    name: str
    spent: int                  # IDR
    monthly_limit: int | None   # IDR; None for the synthetic "Other" row
    is_other: bool = False


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PUBLIC API
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def calculate_financial_stability(
    *,
    total_income_in_window: int,
    total_expense_in_window: int,
    dti_pct: float,
    runway_months: float | None,
    categories: list[CategoryInput],
) -> StabilityScore:
    """
    Compute the 0-100 Financial Stability Score from four weighted components.

    Component weights (analytics_backend.md § Score and Trend Math):
      Cashflow Health  → 30 pts
      Debt Health      → 30 pts
      Savings Runway   → 20 pts
      Spend Discipline → 20 pts

    Inputs are all pre-fetched Python values — no DB calls here.

    Args:
        total_income_in_window:  Sum of income transactions across the analytics
                                 timeframe window (from cashflow series data).
        total_expense_in_window: Sum of expense transactions in the same window.
        dti_pct:                 Debt-to-Income percentage (0–100+).
        runway_months:           Months of liquid_cash / (baseline_costs / 30).
                                 None when baseline_costs == 0.
        categories:              Per-category breakdown list from the query layer.
    """
    cashflow_pts = _score_cashflow(total_income_in_window, total_expense_in_window)
    debt_pts = _score_debt(dti_pct)
    runway_pts = _score_runway(runway_months)
    discipline_pts = _score_discipline(categories)

    total = cashflow_pts + debt_pts + runway_pts + discipline_pts
    total = max(0, min(100, total))   # clamp — safety net for rounding

    explanation = _build_explanation(cashflow_pts, debt_pts, runway_pts, discipline_pts)

    return StabilityScore(
        total=total,
        cashflow_pts=cashflow_pts,
        debt_pts=debt_pts,
        runway_pts=runway_pts,
        discipline_pts=discipline_pts,
        explanation=explanation,
    )


def determine_advisory_priority(
    *,
    total_income_in_window: int,
    dti_pct: float,
    liquid_cash: int,
    baseline_costs: int,
    categories: list[CategoryInput],
    is_savings_target_behind: bool,
) -> AdvisoryResult:
    """
    Return exactly one advisory using the top-down cascade defined in
    analytics_backend.md § Advisory Priority Logic:

      0. insufficient_data — no income logged
      1. critical_debt    — DTI > 35 %
      2. upcoming_payment — liquid_cash < baseline_costs
      3. overspending     — any category > 110 % of monthly limit
      4. savings_target   — active target is behind schedule
      5. optimization     — safe default fallback

    Args:
        total_income_in_window:   Sum of income transactions in the period.
        dti_pct:                  Current Debt-to-Income percentage.
        liquid_cash:              Liquid cash balance in IDR.
        baseline_costs:           Monthly fixed costs from baseline settings.
        categories:               Per-category breakdown (may include "Other" row).
        is_savings_target_behind: True when scoring_service.is_savings_behind_schedule
                                  returned True for the active target.
    """
    # ── Level 0: insufficient_data ────────────────────────────────────────────
    if total_income_in_window <= 0:
        return AdvisoryResult(
            priority="insufficient_data",
            headline="Not Enough Data Yet",
            recommendation="Log at least one income transaction in this period to unlock personalized recommendations.",
            suggested_actions=[],
        )

    # ── Level 1: critical_debt ────────────────────────────────────────────────
    if dti_pct > _DTI_CRITICAL_THRESHOLD:
        return AdvisoryResult(
            priority="critical_debt",
            headline="Debt Load is Critical",
            recommendation=(
                f"Your debt-to-income ratio is {dti_pct:.0f}%, well above the "
                f"safe threshold of {int(_DTI_CRITICAL_THRESHOLD)}%. "
                "Prioritise reducing monthly debt payments immediately."
            ),
        )

    # ── Level 2: upcoming_payment ─────────────────────────────────────────────
    if liquid_cash < baseline_costs:
        shortfall = baseline_costs - liquid_cash
        return AdvisoryResult(
            priority="upcoming_payment",
            headline="Liquid Cash Below Fixed Costs",
            recommendation=(
                f"Your liquid cash ({_fmt_idr(liquid_cash)}) is less than your "
                f"monthly fixed costs ({_fmt_idr(baseline_costs)}). "
                f"You are {_fmt_idr(shortfall)} short — top up your cash balance "
                "before the next payment cycle."
            ),
        )

    # ── Level 3: overspending ─────────────────────────────────────────────────
    overspent = _find_overspent_categories(categories)
    if overspent:
        actions = [
            SuggestedAction(
                category_id=cat.category_id,
                category_name=cat.name,
                # Recommend reducing to exactly 100 % of the monthly limit.
                reduction_amount=cat.spent - (cat.monthly_limit or 0),
            )
            for cat in overspent
        ]
        if len(overspent) == 1:
            headline = f"Reduce {overspent[0].name} Spending"
            recommendation = (
                f"Cut {overspent[0].name} by "
                f"{_fmt_idr(actions[0].reduction_amount)} "
                "to bring it back within your monthly budget."
            )
        else:
            names = ", ".join(c.name for c in overspent[:3])
            total_excess = sum(a.reduction_amount for a in actions)
            headline = "Reduce Variable Spending"
            recommendation = (
                f"{len(overspent)} categories are over budget ({names}). "
                f"Reducing them to their limits would save {_fmt_idr(total_excess)} "
                "this month."
            )
        return AdvisoryResult(
            priority="overspending",
            headline=headline,
            recommendation=recommendation,
            suggested_actions=actions,
        )

    # ── Level 4: savings_target ───────────────────────────────────────────────
    if is_savings_target_behind:
        return AdvisoryResult(
            priority="savings_target",
            headline="Savings Target Behind Schedule",
            recommendation=(
                "Your active savings target is progressing slower than required "
                "to meet the deadline. Consider increasing your monthly contribution."
            ),
        )

    # ── Level 5: optimization (safe fallback) ─────────────────────────────────
    return AdvisoryResult(
        priority="optimization",
        headline="Your Finances Look Healthy",
        recommendation=(
            "No critical issues detected. Review your category limits and consider "
            "increasing your savings target or investment contributions."
        ),
    )


def calculate_debt_free_date(
    *,
    remaining_debt: int,
    avg_monthly_payment: int,
) -> DebtFreeProjection:
    """
    Project the debt payoff date from the current date using a simple
    straight-line division (no interest amortisation — interest is handled
    by the stateless /simulate-loan endpoint).

    Formula (analytics_backend.md § Debt-Free Projection):
        projected_months = remaining_debt / avg_monthly_payment

    Edge cases that produce a null date:
        • remaining_debt == 0   → already debt-free
        • avg_monthly_payment == 0 → no payment history; cannot project

    Args:
        remaining_debt:       ABS(SUM of negative credit wallet balances) in IDR.
        avg_monthly_payment:  Rolling 3-month average of debt_payment category
                              spending, pre-computed by analytics_queries.
    """
    if remaining_debt <= 0:
        return DebtFreeProjection(
            debt_free_date=None,
            debt_free_date_reason="no_active_debt",
        )

    if avg_monthly_payment <= 0:
        return DebtFreeProjection(
            debt_free_date=None,
            debt_free_date_reason="no_payment_history",
        )

    projected_months = math.ceil(remaining_debt / avg_monthly_payment)
    # Clamp to a sensible upper bound (e.g. 600 months / 50 years).
    if projected_months > 600:
        return DebtFreeProjection(
            debt_free_date=None,
            debt_free_date_reason="projection_exceeds_50_years",
        )

    payoff_date = date.today() + timedelta(days=projected_months * 30)
    return DebtFreeProjection(debt_free_date=payoff_date, debt_free_date_reason=None)


def is_savings_behind_schedule(
    *,
    actual_progress_pct: float,
    days_elapsed: int,
    total_days: int,
) -> bool:
    """
    Return True when the savings target is progressing slower than the linear
    schedule implied by its deadline.

    Formula (analytics_backend.md § Behind Schedule Formula):
        expected_pct = (days_elapsed / total_days) * 100
        is_behind    = actual_progress_pct < expected_pct

    Edge cases:
        • total_days <= 0 → treat as on-schedule (degenerate deadline).
        • days_elapsed <= 0 → no time has elapsed; cannot be behind.

    Args:
        actual_progress_pct: (current_amount / target_amount) * 100.
        days_elapsed:        Days since the savings target was created.
        total_days:          Total days between creation date and deadline.
    """
    if total_days <= 0 or days_elapsed <= 0:
        return False

    expected_pct = (days_elapsed / total_days) * 100.0
    return actual_progress_pct < expected_pct


def calculate_trend_percentage(
    *,
    current_period: int,
    previous_period: int,
) -> float | None:
    """
    Percentage change between two periods.

    Formula (analytics_backend.md § Trend Percentage Formula):
        ((current - previous) / previous) * 100

    Returns None when previous_period == 0 (division-by-zero guard).
    The frontend treats None as "no prior data to compare".

    Args:
        current_period:  Sum of the metric in the current window.
        previous_period: Sum of the metric in the prior equivalent window.
    """
    if previous_period == 0:
        return None
    return round(((current_period - previous_period) / previous_period) * 100, 2)


def calculate_score_trend(
    *,
    current_score: int,
    historical_score: int | None,
) -> int:
    """
    Raw delta between the current stability score and the historical anchor.

    Formula (analytics_backend.md § Score Trend):
        score_trend = current_score - historical_score

    Returns 0 when no historical snapshot exists for the timeframe offset.
    """
    if historical_score is None:
        return 0
    return current_score - historical_score


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PRIVATE HELPERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def _score_cashflow(total_income: int, total_expense: int) -> int:
    """
    Map the net cashflow ratio to 0-30 points using a linear band.

    Band:
      net_ratio ≥ +0.30  (saving 30 %+)  → 30 pts
      net_ratio == 0.00  (breakeven)      → 15 pts
      net_ratio ≤ -0.50  (overspend 50 %+)→  0 pts

    Linear interpolation across the range [-0.50, +0.50]:
        score = 30 × (net_ratio − FLOOR) / (EXCELLENT − FLOOR)

    This maps the full range onto [0, 30].
    """
    if total_income <= 0:
        return 0

    net_ratio = (total_income - total_expense) / total_income
    band_width = _CASHFLOW_EXCELLENT_RATIO - _CASHFLOW_FLOOR_RATIO  # 0.80
    score_f = _CASHFLOW_MAX_PTS * (net_ratio - _CASHFLOW_FLOOR_RATIO) / band_width
    return max(0, min(_CASHFLOW_MAX_PTS, round(score_f)))


def _score_debt(dti_pct: float) -> int:
    """
    Map DTI percentage to 0-30 points (linear, clamped).

      DTI = 0 %   → 30 pts
      DTI ≥ 35 %  →  0 pts
    """
    score_f = _DEBT_MAX_PTS * (1.0 - dti_pct / _DTI_CRITICAL_PCT)
    return max(0, min(_DEBT_MAX_PTS, round(score_f)))


def _score_runway(runway_months: float | None) -> int:
    """
    Map survival runway to 0-20 points (linear, clamped).

      0 months  →  0 pts
      6+ months → 20 pts
    """
    if runway_months is None or runway_months <= 0:
        return 0
    score_f = _RUNWAY_MAX_PTS * (runway_months / _RUNWAY_EXCELLENT_MONTHS)
    return max(0, min(_RUNWAY_MAX_PTS, round(score_f)))


def _score_discipline(categories: list[CategoryInput]) -> int:
    """
    Deduct points per overspent category (> 110 % of monthly limit).

    Each overspent category costs ≈ 6.67 pts (20 / 3).
    3+ overspent categories → 0 pts.
    The synthetic "Other" row and categories with no limit are excluded.
    """
    overspent_count = len(_find_overspent_categories(categories))
    score_f = _DISCIPLINE_MAX_PTS - overspent_count * _DISCIPLINE_COST_PER_OVERSPEND
    return max(0, min(_DISCIPLINE_MAX_PTS, round(score_f)))


def _find_overspent_categories(categories: list[CategoryInput]) -> list[CategoryInput]:
    """
    Return categories where spent > 110 % of monthly_limit.
    Excludes the synthetic "Other" row and categories with no limit set.
    """
    overspent = []
    for cat in categories:
        if cat.is_other or cat.monthly_limit is None or cat.monthly_limit <= 0:
            continue
        pct = (cat.spent / cat.monthly_limit) * 100.0
        if pct > _OVERSPEND_ADVISORY_PCT:
            overspent.append(cat)
    return overspent


def _build_explanation(
    cashflow_pts: int,
    debt_pts: int,
    runway_pts: int,
    discipline_pts: int,
) -> str:
    """
    Produce a single human-readable sentence that names the weakest scoring
    component. When all components are strong (score ≥ 80), return a
    positive reinforcement message.
    """
    total = cashflow_pts + debt_pts + runway_pts + discipline_pts

    if total >= 80:
        return "Strong cashflow and disciplined spending are driving your score."

    # Normalise each component to its max to find the proportional weakest.
    normalised = {
        "cashflow":  cashflow_pts  / _CASHFLOW_MAX_PTS,
        "debt":      debt_pts      / _DEBT_MAX_PTS,
        "runway":    runway_pts    / _RUNWAY_MAX_PTS,
        "discipline": discipline_pts / _DISCIPLINE_MAX_PTS,
    }
    weakest = min(normalised, key=lambda k: normalised[k])

    messages = {
        "cashflow":   "High spending is reducing your net cashflow health.",
        "debt":       "Your debt obligations are a significant drag on your score.",
        "runway":     "Your emergency fund runway is below the recommended 6 months.",
        "discipline": "Category overspending is reducing your spend discipline score.",
    }
    return messages[weakest]


def _fmt_idr(amount: int) -> str:
    """
    Format an integer IDR amount in Indonesian notation.

    Example: 300000 → "Rp 300.000"
    """
    # Build the integer string and insert period separators every 3 digits
    # from the right (Indonesian thousands separator is ".").
    s = str(abs(amount))
    groups = []
    while len(s) > 3:
        groups.insert(0, s[-3:])
        s = s[:-3]
    groups.insert(0, s)
    formatted = ".".join(groups)
    prefix = "-Rp " if amount < 0 else "Rp "
    return f"{prefix}{formatted}"

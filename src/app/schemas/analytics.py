"""
app/schemas/analytics.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pydantic v2 schemas for the Analytics module.

Covers:
  - AnalyticsOverviewResponse  →  GET /api/v1/analytics/overview
  - SimulateLoanRequest        →  POST /api/v1/analytics/simulate-loan
  - SimulateLoanResponse       →  POST /api/v1/analytics/simulate-loan

All monetary values are integers in the smallest currency unit (IDR).
The frontend is never expected to perform financial math; these schemas
are the read-only truth layer emitted by the backend scoring engine.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ── Enums ─────────────────────────────────────────────────────────────────────


class Timeframe(str, Enum):
    """Valid query window identifiers accepted by the analytics endpoint."""

    ONE_WEEK = "1w"
    ONE_MONTH = "1m"
    ONE_YEAR = "1y"
    ALL = "all"


class Granularity(str, Enum):
    """Time-series bucket size — determined server-side based on timeframe."""

    DAILY = "daily"    # used for 1w and 1m
    MONTHLY = "monthly"  # used for 1y and all


class AdvisoryPriority(str, Enum):
    """
    Top-down advisory cascade (see analytics_backend.md § Advisory Priority):

      1. critical_debt    — DTI > 35 %
      2. upcoming_payment — liquid_cash < baseline_costs
      3. overspending     — any category > 110 % of monthly limit
      4. savings_target   — active target is behind schedule
      5. optimization     — safe default / no active hazard
    """

    INSUFFICIENT_DATA = "insufficient_data"
    CRITICAL_DEBT = "critical_debt"
    UPCOMING_PAYMENT = "upcoming_payment"
    OVERSPENDING = "overspending"
    SAVINGS_TARGET = "savings_target"
    OPTIMIZATION = "optimization"


class DebtStatus(str, Enum):
    """Qualitative label derived from the DTI percentage."""

    GOOD = "good"        # DTI ≤ 20 %
    WARNING = "warning"  # 20 % < DTI ≤ 35 %
    CRITICAL = "critical"  # DTI > 35 %


# ── Sub-models: Unlock Status ─────────────────────────────────────────────────


class UnlockStatus(BaseModel):
    """
    Feature-gate metadata for the analytics dashboard.
    Analytics requires Level 3 (see api_contract.md § ANALYTICS).
    """

    unlocked: bool
    required_level: int = Field(..., ge=1)
    current_level: int = Field(..., ge=1)
    xp_remaining: int = Field(
        ...,
        ge=0,
        description="XP still needed to reach required_level; 0 when already unlocked.",
    )


# ── Sub-models: Financial Stability ──────────────────────────────────────────


class FinancialStability(BaseModel):
    """
    Composite 0-100 score assembled by scoring_service.py.

    Component weights (analytics_backend.md § Score and Trend Math):
      - Cashflow Health  → 30 pts
      - Debt Health      → 30 pts
      - Savings Runway   → 20 pts
      - Spend Discipline → 20 pts

    score_trend = current_score - historical_score (raw delta, not percentage).
    """

    score: int = Field(..., ge=0, le=100)
    score_version: int = Field(
        ...,
        ge=1,
        description="Schema version of the scoring algorithm — bump when weights change.",
    )
    score_trend: int = Field(
        ...,
        description="Raw delta vs. the historical score at the start of the timeframe window.",
    )
    explanation: str = Field(
        ...,
        description="Human-readable summary of the dominant score driver.",
    )


# ── Sub-models: Advisory ─────────────────────────────────────────────────────


class SuggestedAction(BaseModel):
    """A single actionable category adjustment returned inside Advisory."""

    category_id: UUID
    category_name: str
    reduction_amount: int = Field(
        ...,
        ge=0,
        description="Recommended spend reduction in IDR for this category.",
    )


class Advisory(BaseModel):
    """
    Single highest-priority advisory returned by the top-down cascade.
    suggested_actions is populated only when priority is 'overspending';
    it is an empty list for all other priorities.
    """

    priority: AdvisoryPriority
    headline: str = Field(..., description="Short, action-oriented title shown in the card header.")
    recommendation: str = Field(..., description="Full recommendation sentence shown to the user.")
    suggested_actions: list[SuggestedAction] = Field(
        default_factory=list,
        description="Populated only for 'overspending' priority.",
    )


# ── Sub-models: Cashflow ─────────────────────────────────────────────────────


class CashflowDataPoint(BaseModel):
    """
    One bucket in the cashflow time-series.
    label format:
      - Granularity.DAILY   → "YYYY-MM-DD"
      - Granularity.MONTHLY → "YYYY-MM"
    """

    label: str
    income: int = Field(..., ge=0)
    expense: int = Field(..., ge=0)


class Cashflow(BaseModel):
    """
    Time-series cashflow data for the requested window.
    Capped at 365 data points (analytics_backend.md § Execution Limits).
    trend_percentage is null when previous_period == 0 (division-by-zero guard).
    """

    has_data: bool
    granularity: Granularity
    trend_percentage: Optional[float] = Field(
        default=None,
        description="Null when the previous period had zero income/expense.",
    )
    series: list[CashflowDataPoint]


# ── Sub-models: Income Allocation ────────────────────────────────────────────


class IncomeAllocation(BaseModel):
    """
    Waterfall breakdown of monthly income from baselines table.
    All values are 0 and has_income is False when no income baseline exists.
    """

    has_income: bool
    total_income: int = Field(..., ge=0)
    baseline_costs: int = Field(..., ge=0)
    variable_spending: int = Field(..., ge=0)
    remaining_amount: int = Field(
        ...,
        description="Remaining buffer — may be negative if variable_spending exceeds income.",
    )


# ── Sub-models: Category Breakdown ───────────────────────────────────────────


class CategoryBreakdownItem(BaseModel):
    """
    Per-category spending summary.
    Top 10 by spend are returned individually; the rest are collapsed
    into a synthetic 'Other' row by the service layer.
    percentage = (spent / monthly_limit) * 100
    """

    category_id: UUID
    name: str
    spent: int = Field(..., ge=0)
    percentage: float = Field(..., ge=0, description="Percentage of monthly category limit consumed.")
    is_overspent: bool = Field(
        ...,
        description="True when percentage > 110 % of the monthly limit.",
    )


class CategoryBreakdown(BaseModel):
    has_category_data: bool
    categories: list[CategoryBreakdownItem]


# ── Sub-models: Top Transactions ─────────────────────────────────────────────


class TopTransaction(BaseModel):
    """
    One of the top 5 largest expense transactions within the timeframe.
    Fetched by analytics_queries.get_top_transactions().
    """

    id: UUID
    amount: int = Field(..., ge=0)
    category_name: str
    wallet_name: str
    transaction_date: date
    note: Optional[str] = None


# ── Sub-models: Debt Health ───────────────────────────────────────────────────


class DebtHealth(BaseModel):
    """
    Debt position snapshot derived from credit wallet balances and
    debt_payment category transactions.

    debt_free_date is null when:
      - active_loans == 0, OR
      - average monthly payment == 0 (no recent payments to project from)
    debt_free_date_reason is populated with a human-readable explanation
    in the null case.

    safe_loan_limit = monthly_income * 0.35 - current_monthly_debt_payments
    """

    dti_percentage: float = Field(..., ge=0, description="Debt-to-Income ratio as a percentage.")
    status: DebtStatus
    active_loans: int = Field(..., ge=0)
    safe_loan_limit: int = Field(
        ...,
        ge=0,
        description="Max additional monthly debt payment before breaching 35% DTI threshold.",
    )
    debt_free_date: Optional[date] = Field(
        default=None,
        description="Projected payoff date. Null when projection is not computable.",
    )
    debt_free_date_reason: Optional[str] = Field(
        default=None,
        description="Human-readable explanation when debt_free_date is null.",
    )


# ── Sub-models: Asset Health → Savings Target ────────────────────────────────


class SavingsTargetSummary(BaseModel):
    """
    Snapshot of the single highest-priority (earliest deadline) active
    savings target. All nullable fields are None when has_savings_target
    is False.
    """

    has_savings_target: bool
    target_name: Optional[str] = None
    target_amount: Optional[int] = Field(default=None, ge=0)
    current_amount: Optional[int] = Field(default=None, ge=0)
    progress_percentage: Optional[float] = Field(
        default=None,
        ge=0,
        description="(current_amount / target_amount) * 100",
    )
    deadline: Optional[date] = None
    is_behind_schedule: Optional[bool] = Field(
        default=None,
        description=(
            "True when actual_progress_percentage < (days_elapsed / total_days) * 100. "
            "Computed by scoring_service.is_behind_schedule()."
        ),
    )


class AssetHealth(BaseModel):
    """
    Liquidity, investment, and runway snapshot.

    survival_runway_months = liquid_cash / monthly_baseline_costs
    Null when baseline_costs == 0.
    """

    liquid_cash: int = Field(
        ...,
        description="SUM(wallet.balance) WHERE type IN ('cash', 'bank', 'savings')",
    )
    net_liquid_cash: int = Field(
        ...,
        description="liquid_cash + SUM(credit wallet balances) — can be negative.",
    )
    invested_assets: int = Field(
        ...,
        ge=0,
        description="SUM(wallet.balance) WHERE type = 'investment'",
    )
    has_investments: bool
    survival_runway_months: Optional[float] = Field(
        default=None,
        ge=0,
        description="Months of baseline costs covered by liquid cash. Null if no baseline.",
    )
    savings_target: SavingsTargetSummary


# ── Root Response ─────────────────────────────────────────────────────────────


class AnalyticsOverviewResponse(BaseModel):
    """
    Complete hydration payload for GET /api/v1/analytics/overview.

    Assembled by analytics_service.get_overview_payload() using
    asyncio.gather() across multiple query functions, then passed through
    scoring_service for derived metrics.

    analytics_version must be bumped whenever the shape of this model
    changes in a breaking way so frontends can detect schema drift.
    """

    analytics_version: int = Field(..., ge=1)
    generated_at: datetime = Field(..., description="UTC timestamp of payload assembly.")
    timeframe: Timeframe
    unlock_status: UnlockStatus
    financial_stability: FinancialStability
    advisory: Advisory
    cashflow: Cashflow
    income_allocation: IncomeAllocation
    category_breakdown: CategoryBreakdown
    top_transactions: list[TopTransaction] = Field(
        ...,
        max_length=5,
        description="Capped at 5 rows by analytics_queries.get_top_transactions().",
    )
    debt_health: DebtHealth
    asset_health: AssetHealth


# ── Loan Simulation ───────────────────────────────────────────────────────────


class SimulateLoanRequest(BaseModel):
    """
    Stateless loan projection calculator — POST /api/v1/analytics/simulate-loan.
    Does not touch the database; scoring_service performs pure arithmetic.

    annual_interest_rate is optional. When omitted the projection assumes
    zero interest (simple division: remaining_debt / monthly_payment).
    When provided, amortisation logic applies and total_interest_paid is
    populated in the response.
    """

    remaining_debt: int = Field(
        ...,
        gt=0,
        description="Total outstanding principal in IDR.",
    )
    monthly_payment: int = Field(
        ...,
        gt=0,
        description="Planned monthly payment in IDR.",
    )
    annual_interest_rate: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=5.0,
        description=(
            "Annual interest rate as a decimal (e.g. 0.12 = 12 %). "
            "Max 5.0 (500 %) to block obviously invalid inputs. "
            "Omit for a zero-interest straight-line projection."
        ),
    )


class SimulateLoanResponse(BaseModel):
    """
    Projection result for POST /api/v1/analytics/simulate-loan.

    is_payable is False when the monthly_payment does not cover the first
    month's interest charge — i.e. the loan would never be paid off.
    projected_months and debt_free_date are None in that case.
    total_interest_paid is None when annual_interest_rate was not provided.
    """

    remaining_debt: int = Field(..., ge=0)
    monthly_payment: int = Field(..., ge=0)
    annual_interest_rate: Optional[float] = None
    is_payable: bool = Field(
        ...,
        description="False if monthly_payment ≤ first month's interest accrual.",
    )
    projected_months: Optional[int] = Field(
        default=None,
        ge=1,
        description="Months until fully paid off. Null when is_payable is False.",
    )
    debt_free_date: Optional[date] = Field(
        default=None,
        description="Projected payoff date (today + projected_months). Null when is_payable is False.",
    )
    total_interest_paid: Optional[int] = Field(
        default=None,
        ge=0,
        description="Cumulative interest cost in IDR. Null when no interest rate was supplied.",
    )


# ── Rebalance Budget ──────────────────────────────────────────────────────────


class RebalanceAdjustment(BaseModel):
    category_id: UUID
    category_name: str
    current_limit: int
    new_limit: int = Field(..., ge=0)


class RebalanceBudgetPayload(BaseModel):
    strategy: str
    adjustments: list[RebalanceAdjustment]


# ── Savings Target ────────────────────────────────────────────────────────────


class SavingsTargetPayload(BaseModel):
    name: str
    amount: int = Field(..., gt=0)
    deadline: date

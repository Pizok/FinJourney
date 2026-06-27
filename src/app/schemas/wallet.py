"""
app/schemas/wallet.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pydantic v2 schemas for the Wallet resource.

Covers:
  - WalletCreate            →  POST /api/v1/wallets          (Level 3+)
  - WalletOut               →  GET  /api/v1/wallets
  - RebalanceBudgetRequest  →  POST /api/v1/wallets/rebalance-budget  [NEW]

The rebalance endpoint is owned by wallet_service.py, not analytics_service.
Analytics only surfaces the advisory recommendation payload; the mutation
itself is triggered here.

See api_contract.md § WALLETS and analytics_backend.md § Read-Only Boundary.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ── Enum ──────────────────────────────────────────────────────────────────────


class WalletType(str, Enum):
    """
    Wallet classification used by analytics asset/debt calculations.

    Liquid types (cash, bank, savings) feed into liquid_cash.
    Investment feeds into invested_assets.
    Credit feeds into net_liquid_cash and active_loans (when balance < 0).
    """

    CASH = "cash"
    BANK = "bank"
    SAVINGS = "savings"
    INVESTMENT = "investment"
    CREDIT = "credit"
    E_WALLET = "e_wallet"


# ── Create ────────────────────────────────────────────────────────────────────


class WalletCreate(BaseModel):
    """
    Payload for POST /api/v1/wallets.
    Requires Level 3+; the endpoint enforces the gate — schema is dumb.

    icon references a key in the game_assets registry (asset_type = 'icon').
    It is optional; the frontend falls back to a default lucide-react icon.
    """

    name: str = Field(
        ...,
        min_length=1,
        max_length=60,
        description="User-facing wallet label, e.g. 'BCA Checking', 'Emergency Fund'.",
    )
    wallet_type: WalletType = Field(
        default=WalletType.BANK,
        description="Determines how this wallet feeds into analytics calculations.",
    )
    icon: Optional[str] = Field(
        default=None,
        description="Asset registry key for the wallet icon (unlocked via Level 2 icon customization).",
    )
    balance: int = Field(
        default=0,
        description="Initial balance for the wallet.",
    )
    visible_category_ids: list[UUID] = Field(
        default_factory=list,
        description="List of category UUIDs that are visible when this wallet is selected.",
    )


# ── Out (read) ────────────────────────────────────────────────────────────────

class WalletUpdate(BaseModel):
    """
    Payload for PATCH /api/v1/wallets/{id}.
    """
    name: Optional[str] = Field(None, min_length=1, max_length=60)
    color_token: Optional[str] = None
    description: Optional[str] = None
    default_payment_method: Optional[str] = None
    visible_category_ids: Optional[list[str]] = None



class WalletOut(BaseModel):
    """
    Full wallet record returned by GET /api/v1/wallets.
    balance is stored in IDR and never negative for cash/bank/savings types.
    Credit wallets may carry a negative balance representing outstanding debt.
    """

    id: UUID
    user_id: UUID
    name: str
    wallet_type: WalletType
    icon: Optional[str] = None
    balance: int = Field(..., description="Current balance in IDR.")
    visible_category_ids: list[UUID] = Field(
        default_factory=list,
        description="Categories linked to this wallet."
    )

    model_config = {"from_attributes": True}


# ── Rebalance Budget ──────────────────────────────────────────────────────────


class CategoryBudgetAdjustment(BaseModel):
    """
    A single line-item in a budget rebalance operation.

    new_monthly_limit replaces the existing monthly limit for the given
    category. The service layer validates:
      - user owns the category (RLS)
      - the sum of all new_monthly_limit values does not exceed
        (total_income - baseline_costs) to prevent an impossible budget
    """

    category_id: UUID = Field(
        ...,
        description="The category whose monthly limit will be overwritten.",
    )
    new_monthly_limit: int = Field(
        ...,
        ge=0,
        description=(
            "New monthly spending cap in IDR. "
            "Setting 0 effectively disables spending tracking for this category."
        ),
    )


class RebalanceBudgetRequest(BaseModel):
    """
    Payload for POST /api/v1/wallets/rebalance-budget.

    This endpoint is the action counterpart to the analytics advisory.
    The frontend builds this payload from Advisory.suggested_actions by
    converting reduction_amount offsets into absolute new_monthly_limit values.

    Constraints enforced by wallet_service.rebalance_budget():
      - All category_ids must belong to the authenticated user.
      - The combined new limits must be financially coherent (non-zero income).
      - Each adjustment generates an append-only game_event for audit purposes.
      - The operation is idempotent: re-submitting the same limits is safe.

    At least one adjustment must be present; an empty list is rejected.
    """

    adjustments: list[CategoryBudgetAdjustment] = Field(
        ...,
        min_length=1,
        description="One or more category limit overrides to apply atomically.",
    )


# ── Bootstrap ─────────────────────────────────────────────────────────────────

class FinancialAssumptions(BaseModel):
    expected_monthly_income: int = 0
    monthly_savings_target: int = 0


class WalletBootstrapResponse(BaseModel):
    wallets: list[dict] = Field(default_factory=list)
    category_limits: list[dict] = Field(default_factory=list)
    recent_transactions: list[dict] = Field(default_factory=list)
    fixed_expenses: list[dict] = Field(default_factory=list)
    active_loans: list[dict] = Field(default_factory=list)
    financial_assumptions: FinancialAssumptions = Field(default_factory=FinancialAssumptions)
    pagination: dict = Field(default_factory=dict)
    feature_unlocks: dict = Field(default_factory=dict)


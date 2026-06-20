"""
wallet_summary.py — Aggregate response schemas for GET /api/v1/wallets/summary.

This endpoint is the single source of truth for the Wallet page's top-level
financial state. The frontend must never re-derive any of these values; it
only formats and renders what is returned here.

All monetary fields are in integer cents.
"""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.wallet import WalletOut


# ---------------------------------------------------------------------------
# Level restriction block
# ---------------------------------------------------------------------------

class LevelRestrictions(BaseModel):
    """
    Communicates the current user's creation limits to the frontend.

    The frontend uses this to enable/disable creation CTAs and display
    the Level 3 unlock prompt without performing any independent logic.

    Level gates (from spec):
      * Level 1 → max 3 wallets, max 10 categories
      * Level 3 → unlimited wallets and categories
    """

    max_wallets: int = Field(
        description="Maximum wallets allowed at the user's current level."
    )
    max_categories: int = Field(
        description="Maximum categories allowed at the user's current level."
    )
    can_create_wallet: bool = Field(
        description="True if the user has not reached the wallet cap."
    )
    can_create_category: bool = Field(
        description="True if the user has not reached the category cap."
    )


# ---------------------------------------------------------------------------
# Per-category spending summary
# ---------------------------------------------------------------------------

class CategoryUsage(BaseModel):
    """
    Spending summary for a single global category within the current calendar month.

    Fields
    ------
    category_id  — UUID of the category.
    name         — Display name.
    spent        — Sum of active expense transactions this month (integer cents).
    limit        — The category's monthly_limit (integer cents). 0 = uncapped.
    remaining    — limit - spent, clamped at 0 when overspent (integer cents).
    percentage   — (spent / limit) * 100, rounded to the nearest integer.
                   Returns 0 when limit = 0 (uncapped); never exceeds 100.
    is_overspent — True when spent > limit AND limit > 0.

    All arithmetic is performed by the backend; the frontend renders only.
    """

    category_id: UUID
    name: str
    spent: int = Field(ge=0, description="Total spent this month in integer cents.")
    limit: int = Field(ge=0, description="Monthly cap in integer cents. 0 = uncapped.")
    remaining: int = Field(
        ge=0,
        description=(
            "Remaining budget in integer cents. "
            "0 when overspent or uncapped with no concept of remaining."
        ),
    )
    percentage: int = Field(
        ge=0,
        le=100,
        description="Percentage of limit consumed (0–100). 0 when uncapped.",
    )
    is_overspent: bool

    @model_validator(mode="after")
    def validate_derived_consistency(self) -> "CategoryUsage":
        """
        Guard against backend bugs: verify that the derived fields are
        internally consistent before the payload reaches the frontend.
        """
        if self.limit > 0:
            expected_remaining = max(0, self.limit - self.spent)
            if self.remaining != expected_remaining:
                raise ValueError(
                    f"remaining ({self.remaining}) is inconsistent with "
                    f"limit ({self.limit}) - spent ({self.spent}) = {expected_remaining}."
                )
            expected_pct = min(100, round((self.spent / self.limit) * 100))
            if self.percentage != expected_pct:
                raise ValueError(
                    f"percentage ({self.percentage}) is inconsistent with "
                    f"spent/limit ratio ({expected_pct})."
                )
            expected_overspent = self.spent > self.limit
            if self.is_overspent != expected_overspent:
                raise ValueError(
                    f"is_overspent ({self.is_overspent}) is inconsistent "
                    f"with spent ({self.spent}) > limit ({self.limit})."
                )
        else:
            # Uncapped category: derived fields must be zero / False
            if self.remaining != 0:
                raise ValueError(
                    "remaining must be 0 for uncapped categories (limit = 0)."
                )
            if self.percentage != 0:
                raise ValueError(
                    "percentage must be 0 for uncapped categories (limit = 0)."
                )
            if self.is_overspent:
                raise ValueError(
                    "is_overspent must be False for uncapped categories (limit = 0)."
                )
        return self


# ---------------------------------------------------------------------------
# Top-level wallet summary response
# ---------------------------------------------------------------------------

class WalletSummaryResponse(BaseModel):
    """
    Aggregate payload returned by GET /api/v1/wallets/summary.

    This is the primary hydration payload for the Wallet page's top section.
    The frontend must never recompute total_balance or category_usage values.

    Fields
    ------
    total_balance    — Sum of all active wallet balances (integer cents).
    wallet_count     — Count of non-deleted wallets owned by the user.
    category_count   — Count of non-deleted categories owned by the user.
    active_wallet_id — Currently selected wallet filter UUID, or null when
                       viewing all wallets (default/unfiltered state).
    wallets          — Full list of WalletOut objects for rendering cards.
    category_usage   — Per-category spending summaries for the current month.
    level_restrictions — Creation caps and capability flags for the user's level.
    """

    total_balance: int = Field(
        description="Net balance across all active wallets in integer cents."
    )
    wallet_count: int = Field(ge=0)
    category_count: int = Field(ge=0)
    active_wallet_id: Optional[UUID] = Field(
        default=None,
        description="Filter context: UUID of the selected wallet, or null for all.",
    )
    wallets: List[WalletOut]
    category_usage: List[CategoryUsage]
    level_restrictions: LevelRestrictions

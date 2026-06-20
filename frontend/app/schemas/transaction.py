"""
transaction.py — Pydantic schemas for the Transaction resource.

KEY UPDATE (Wallet module integration)
---------------------------------------
This file replaces the previous transaction schema to enforce strict
field-presence rules per transaction type and add payment_method support.

Field presence rules (enforced via model_validator):
  income   → wallet_id required, category_id required,
              source_wallet_id null, destination_wallet_id null.
  expense  → wallet_id required, category_id required,
              source_wallet_id null, destination_wallet_id null.
  transfer → wallet_id null, category_id null,
              source_wallet_id required, destination_wallet_id required,
              source_wallet_id ≠ destination_wallet_id.

All monetary fields (amount) are integer cents; amount must be > 0.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TransactionType(str, Enum):
    income   = "income"
    expense  = "expense"
    transfer = "transfer"


class TransactionStatus(str, Enum):
    active  = "active"
    deleted = "deleted"


class PaymentMethod(str, Enum):
    """
    How the transaction was executed.
    Used for cash-flow analytics; required on income and expense.
    Transfers between wallets do not require a payment method.
    """
    cash        = "cash"
    debit_card  = "debit_card"
    credit_card = "credit_card"
    e_wallet    = "e_wallet"
    other       = "other"


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class TransactionCreate(BaseModel):
    """
    Payload for POST /api/v1/transactions.

    Validation summary
    ------------------
    1. amount > 0, stored as integer cents.
    2. transaction_date may not be in the future (enforced by field_validator).
    3. Type-conditional field rules are enforced by model_validator:
       - income / expense: wallet_id + category_id required; transfers null.
       - transfer: source + destination required and distinct; wallet/category null.
    4. payment_method is required for income and expense; null for transfers.

    Game mechanics note
    -------------------
    * expense → triggers Daily Bleed pipeline via budget_service.
    * transfer → balance move only; no XP granted, no HP penalty.
    * income → no shield gained (per logic.md).
    """

    type: TransactionType

    # --- Core fields (income / expense) ---
    wallet_id:   Optional[UUID] = Field(default=None)
    category_id: Optional[UUID] = Field(default=None)

    # --- Transfer fields ---
    source_wallet_id:      Optional[UUID] = Field(default=None)
    destination_wallet_id: Optional[UUID] = Field(default=None)

    # --- Shared ---
    amount:         int = Field(..., gt=0, description="Amount in integer cents.")
    payment_method: Optional[PaymentMethod] = Field(default=None)
    transaction_date: date = Field(..., description="Must not be a future date.")
    note: Optional[str] = Field(default=None, max_length=256)

    # ------------------------------------------------------------------
    # Field-level validators
    # ------------------------------------------------------------------

    @field_validator("transaction_date", mode="before")
    @classmethod
    def date_not_in_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("Transaction date cannot be in the future.")
        return v

    @field_validator("note", mode="before")
    @classmethod
    def strip_note(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        stripped = v.strip()
        return stripped if stripped else None

    # ------------------------------------------------------------------
    # Cross-field type validation
    # ------------------------------------------------------------------

    @model_validator(mode="after")
    def enforce_type_field_rules(self) -> "TransactionCreate":
        t = self.type

        if t in (TransactionType.income, TransactionType.expense):
            # wallet_id and category_id are required
            if self.wallet_id is None:
                raise ValueError(
                    f"wallet_id is required for type '{t.value}'."
                )
            if self.category_id is None:
                raise ValueError(
                    f"category_id is required for type '{t.value}'."
                )
            # Transfer-specific fields must be absent
            if self.source_wallet_id is not None:
                raise ValueError(
                    f"source_wallet_id must be null for type '{t.value}'."
                )
            if self.destination_wallet_id is not None:
                raise ValueError(
                    f"destination_wallet_id must be null for type '{t.value}'."
                )
            # Payment method is required for real transactions
            if self.payment_method is None:
                raise ValueError(
                    f"payment_method is required for type '{t.value}'."
                )

        elif t == TransactionType.transfer:
            # Source and destination wallets are required
            if self.source_wallet_id is None:
                raise ValueError(
                    "source_wallet_id is required for type 'transfer'."
                )
            if self.destination_wallet_id is None:
                raise ValueError(
                    "destination_wallet_id is required for type 'transfer'."
                )
            # Cannot transfer to the same wallet
            if self.source_wallet_id == self.destination_wallet_id:
                raise ValueError(
                    "source_wallet_id and destination_wallet_id must be different."
                )
            # wallet_id and category_id must be absent
            if self.wallet_id is not None:
                raise ValueError(
                    "wallet_id must be null for type 'transfer'."
                )
            if self.category_id is not None:
                raise ValueError(
                    "category_id must be null for type 'transfer'."
                )
            # Transfers have no payment method
            if self.payment_method is not None:
                raise ValueError(
                    "payment_method must be null for type 'transfer'."
                )

        return self


class TransactionUpdate(BaseModel):
    """
    Payload for PATCH /api/v1/transactions/{id}.

    Editable fields are limited to mutable presentation/data fields.
    Changing type is not supported — the original type is locked at creation
    to preserve the integrity of the game_events ledger.

    Per anti-cheat rules (logic.md):
    * Editing a past transaction generates a backend adjustment event.
    * The original Daily Snapshot is not modified.
    * HP penalties already applied are not refunded.
    * The edit window is enforced by the service layer (not here).

    amount, if updated, must still be > 0 and stored as integer cents.
    transaction_date must not be in the future.
    At least one field must be provided.
    """

    amount:           Optional[int]           = Field(default=None, gt=0)
    category_id:      Optional[UUID]          = Field(default=None)
    wallet_id:        Optional[UUID]          = Field(default=None)
    payment_method:   Optional[PaymentMethod] = Field(default=None)
    transaction_date: Optional[date]          = Field(default=None)
    note:             Optional[str]           = Field(default=None, max_length=256)

    @field_validator("transaction_date", mode="before")
    @classmethod
    def date_not_in_future(cls, v: Optional[date]) -> Optional[date]:
        if v is None:
            return v
        if v > date.today():
            raise ValueError("Transaction date cannot be in the future.")
        return v

    @field_validator("note", mode="before")
    @classmethod
    def strip_note(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        stripped = v.strip()
        return stripped if stripped else None

    def model_post_init(self, __context: object) -> None:  # noqa: ANN001
        fields = (
            self.amount,
            self.category_id,
            self.wallet_id,
            self.payment_method,
            self.transaction_date,
            self.note,
        )
        if all(f is None for f in fields):
            raise ValueError("At least one field must be provided for an update.")


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class TransactionOut(BaseModel):
    """
    Outbound transaction representation.

    amount is returned in integer cents.
    transfer_group_id links both legs of a transfer operation (set by backend).
    The frontend must never derive financial totals from a list of these;
    use the wallet summary endpoint for aggregated figures.
    """

    id:                    UUID
    user_id:               UUID
    type:                  TransactionType
    status:                TransactionStatus

    # income / expense
    wallet_id:   Optional[UUID]
    category_id: Optional[UUID]

    # transfer
    source_wallet_id:      Optional[UUID]
    destination_wallet_id: Optional[UUID]
    transfer_group_id:     Optional[UUID]

    # shared
    amount:           int = Field(description="Amount in integer cents.")
    payment_method:   Optional[PaymentMethod]
    transaction_date: date
    note:             Optional[str]
    created_at:       datetime

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    """
    Paginated transaction list payload.

    Mirrors the pagination contract defined in wallet_backend.md.
    The frontend must request the next page by incrementing `page`
    and passing it as a query parameter.
    """

    items:       list[TransactionOut]
    page:        int = Field(ge=1)
    limit:       int = Field(ge=1)
    total:       int = Field(ge=0, description="Total transaction count (unfiltered by page).")
    total_pages: int = Field(ge=0)

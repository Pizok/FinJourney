"""
app/schemas/savings_targets.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pydantic v2 schemas for the SavingsTarget resource.

Table: savings_targets (introduced in analytics_backend.md § New Schema)

  id              UUID        PK
  user_id         UUID        FK → profiles
  name            String
  target_amount   Integer     cents / IDR
  current_amount  Integer     cents / IDR
  deadline        Date
  status          Enum        active | completed | archived
  created_at      Timestamp
  deleted_at      Timestamp?  soft-delete sentinel

Analytics surfaces only the single target with the earliest deadline (ASC)
via SavingsTargetSummary inside AnalyticsOverviewResponse. These CRUD
schemas back the full management endpoints.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


# ── Enum ──────────────────────────────────────────────────────────────────────


class SavingsTargetStatus(str, Enum):
    """
    Lifecycle states for a savings target.

    active    — in progress; surfaced in analytics advisory cascade.
    completed — target_amount reached; excluded from analytics scoring.
    archived  — manually dismissed; soft-deleted equivalent for UI purposes.
    """

    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


# ── Create ────────────────────────────────────────────────────────────────────


class SavingsTargetCreate(BaseModel):
    """
    Payload for POST /savings-targets (endpoint to be added in api_contract.md).

    current_amount defaults to 0 — the user may optionally seed an existing
    balance when creating the target (e.g. they already have partial savings).

    Invariant: current_amount must not exceed target_amount on creation.
    """

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Short user-facing label, e.g. 'Emergency Fund', 'Laptop'.",
    )
    target_amount: int = Field(
        ...,
        gt=0,
        description="Goal amount in IDR. Must be a positive integer.",
    )
    current_amount: int = Field(
        default=0,
        ge=0,
        description="Existing balance already saved toward this target. Defaults to 0.",
    )
    deadline: date = Field(
        ...,
        description="Target completion date. Must be in the future.",
    )
    monthly_contribution: int = Field(
        ...,
        ge=0,
        description="Expected monthly contribution in IDR. Must be non-negative.",
    )

    @model_validator(mode="after")
    def current_must_not_exceed_target(self) -> SavingsTargetCreate:
        if self.current_amount > self.target_amount:
            raise ValueError(
                "current_amount cannot exceed target_amount on creation. "
                f"Got current_amount={self.current_amount}, target_amount={self.target_amount}."
            )
        return self

    @model_validator(mode="after")
    def deadline_must_be_future(self) -> SavingsTargetCreate:
        if self.deadline <= date.today():
            raise ValueError(
                "deadline must be a future date. "
                f"Got deadline={self.deadline}, today={date.today()}."
            )
        return self


# ── Update ────────────────────────────────────────────────────────────────────


class SavingsTargetUpdate(BaseModel):
    """
    Payload for PATCH /savings-targets/{id}.

    All fields are optional — partial updates are fully supported.
    The service layer must re-evaluate is_behind_schedule after any
    update to deadline, target_amount, or current_amount.

    Setting status to 'completed' or 'archived' soft-retires the target
    from the analytics advisory cascade.
    """

    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    target_amount: Optional[int] = Field(
        default=None,
        gt=0,
    )
    current_amount: Optional[int] = Field(
        default=None,
        ge=0,
        description=(
            "Direct balance override. Use this to record a manual progress update "
            "rather than deriving balance from transactions."
        ),
    )
    deadline: Optional[date] = None
    status: Optional[SavingsTargetStatus] = Field(
        default=None,
        description=(
            "Explicitly setting 'completed' or 'archived' removes this target "
            "from the analytics advisory queue."
        ),
    )
    monthly_contribution: Optional[int] = Field(
        default=None,
        ge=0,
    )


# ── Out (read) ────────────────────────────────────────────────────────────────


class SavingsTargetOut(BaseModel):
    """
    Full database row returned to the frontend.

    deleted_at is included so clients can detect soft-deleted records
    if they request archived targets; it will be None for active/completed.

    Computed helpers (progress_percentage, is_behind_schedule) live in
    scoring_service.py — they are not stored columns and therefore not
    part of this schema. The analytics overlay (SavingsTargetSummary)
    adds them at read time.
    """

    id: UUID
    user_id: UUID
    name: str
    target_amount: int = Field(..., ge=0)
    current_amount: int = Field(..., ge=0)
    deadline: date
    status: SavingsTargetStatus
    monthly_contribution: int = Field(..., ge=0)
    created_at: datetime
    deleted_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

# ── Log Savings ───────────────────────────────────────────────────────────────

class LogSavingsRequest(BaseModel):
    """Payload for POST /savings-targets/{id}/log"""
    amount: int = Field(..., gt=0, description="Amount to log to this savings target in IDR")
    wallet_id: UUID = Field(..., description="Wallet ID to deduct the amount from")
    note: Optional[str] = Field(default=None, description="Optional note for the transaction")

class LogSavingsResponse(BaseModel):
    success: bool
    savings_target: SavingsTargetOut

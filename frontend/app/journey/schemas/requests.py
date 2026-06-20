"""
src/backend/journey/models/requests.py

Pydantic v2 request DTOs for the Journey Engine.
All validation logic lives here so routers stay thin.
"""
from __future__ import annotations

from enum import Enum
from uuid import UUID

from pydantic import BaseModel, field_validator


# ---------------------------------------------------------------------------
# Shared Enums
# ---------------------------------------------------------------------------


class PlayerPath(str, Enum):
    """The four selectable progression paths available to a player."""

    SENTINEL = "SENTINEL"
    CATALYST = "CATALYST"
    PHANTOM = "PHANTOM"
    UNASSIGNED = "UNASSIGNED"


class NotificationUpdateStatus(str, Enum):
    """Valid client-driven transitions for a notification object."""

    READ = "READ"
    ARCHIVED = "ARCHIVED"


# ---------------------------------------------------------------------------
# Core Player Action Requests
# ---------------------------------------------------------------------------


class ZeroSpendClaimRequest(BaseModel):
    """
    Claims a Zero-Spend day, granting XP and Ghost Penalty protection.
    No payload required — eligibility is validated entirely server-side
    (no prior expenses today, not in CRITICAL_FAILURE state).
    """

    model_config = {"extra": "forbid"}


class StandbyUseRequest(BaseModel):
    """
    Activates a Standby Token to freeze the Ghost Penalty for 24 hours.
    No payload required — token availability is validated server-side.
    """

    model_config = {"extra": "forbid"}


class PathChangeRequest(BaseModel):
    """
    Switches the player's active progression path.
    Triggers a 6-month cooldown on the profile after a successful change.
    """

    model_config = {"extra": "forbid"}

    new_path: PlayerPath

    @field_validator("new_path")
    @classmethod
    def path_must_be_selectable(cls, v: PlayerPath) -> PlayerPath:
        if v == PlayerPath.UNASSIGNED:
            raise ValueError(
                "UNASSIGNED is a system-only state. "
                "Select one of: SENTINEL, CATALYST, PHANTOM."
            )
        return v


class ReviveRequest(BaseModel):
    """
    Executes the Financial Audit recovery flow to exit CRITICAL_FAILURE.
    Restores HP to 10 and transitions vitality state to HAZARD.
    The player must explicitly acknowledge the audit before the backend proceeds.
    """

    model_config = {"extra": "forbid"}

    audit_acknowledged: bool

    @field_validator("audit_acknowledged")
    @classmethod
    def must_be_acknowledged(cls, v: bool) -> bool:
        if not v:
            raise ValueError(
                "audit_acknowledged must be true. "
                "The player must confirm the financial audit review to restore account access."
            )
        return v


class RewardClaimRequest(BaseModel):
    """
    Claims pending XP and HP rewards from a COMPLETED Quarterly Challenge.
    The challenge must belong to the requesting user (enforced server-side via RLS).
    """

    model_config = {"extra": "forbid"}

    challenge_id: UUID


class NotificationUpdateRequest(BaseModel):
    """Transitions a single notification to READ or ARCHIVED."""

    model_config = {"extra": "forbid"}

    status: NotificationUpdateStatus


class UnlockAcknowledgeRequest(BaseModel):
    """
    Marks a Level-Up feature unlock as acknowledged by the client.
    Prevents the unlock modal from reappearing in subsequent /bootstrap calls.
    No payload required — the unlock ID is supplied as a path parameter.
    """

    model_config = {"extra": "forbid"}


# ---------------------------------------------------------------------------
# Internal / Cron Webhook Requests
# ---------------------------------------------------------------------------


class CronDailyEvaluationRequest(BaseModel):
    """
    Internal request body sent by Upstash QStash to trigger
    the rolling midnight evaluation job.

    Authentication: Upstash-Signature header verification ONLY.
    No user JWT is required or accepted on this endpoint.

    Fields:
        target_timezone: IANA timezone string, e.g. "Asia/Jakarta".
        trigger_date:    ISO-8601 date string for the local date being
                         evaluated, e.g. "2026-10-14".
    """

    model_config = {"extra": "forbid"}

    target_timezone: str
    trigger_date: str  # "YYYY-MM-DD" — validated downstream by the service

    @field_validator("target_timezone")
    @classmethod
    def timezone_must_not_be_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("target_timezone cannot be empty.")
        return v

    @field_validator("trigger_date")
    @classmethod
    def date_must_be_iso_format(cls, v: str) -> str:
        from datetime import date as _date

        try:
            _date.fromisoformat(v)
        except ValueError:
            raise ValueError(
                f"trigger_date must be ISO-8601 format (YYYY-MM-DD), got: '{v}'"
            )
        return v


class CronSystemCleanupRequest(BaseModel):
    """
    Internal request sent by Upstash QStash for the Daily Janitor job.
    Handles shield expiration, stale token cleanup, and orphaned challenge states.
    Authentication: Upstash-Signature header verification only.
    """

    model_config = {"extra": "forbid"}


# ---------------------------------------------------------------------------
# Cross-Domain Integration Payloads
# ---------------------------------------------------------------------------


class WalletTransactionEventPayload(BaseModel):
    """
    Payload passed from WalletService → JourneyService via FastAPI BackgroundTasks
    when a transaction is saved to the financial ledger.
    This is an internal contract, not a user-facing endpoint.
    """

    model_config = {"extra": "forbid"}

    user_id: str
    transaction_id: str
    transaction_type: str  # "income" | "expense" | "transfer"
    amount: float
    category_id: str | None = None
    is_over_budget: bool = False

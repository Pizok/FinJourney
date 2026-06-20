"""
settings_responses.py
─────────────────────
Pydantic v2 response schemas for the FinJourney Settings & Account Management
module.  Every schema is the typed, validated shape of what the backend
serialises and the frontend deserialises.

Re-exports SettingsErrorCode and SettingsErrorCodeLiteral so callers have a
single import surface for the whole settings domain:

    from journey.models.settings_responses import (
        SettingsHydrationResponse,
        SettingsErrorCode,
        SettingsErrorEnvelope,
    )
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, Field

# Re-export error codes from requests module so callers import from one place.
from .settings_requests import SettingsErrorCode, SettingsErrorCodeLiteral  # noqa: F401


# ══════════════════════════════════════════════════════════════════════════════
# Shared envelope helpers
# ══════════════════════════════════════════════════════════════════════════════

class StandardErrorDetail(BaseModel):
    """Inner ``error`` object in a failure envelope."""

    code: SettingsErrorCodeLiteral
    message: str
    meta: dict[str, Any] | None = Field(
        default=None,
        description=(
            "Optional structured payload — e.g. {'available': 3640000} for "
            "INVALID_SAVINGS_TARGET so the frontend can render an exact hint."
        ),
    )


class SettingsErrorEnvelope(BaseModel):
    """
    Standard failure response shape for all settings endpoints.

    Example::

        {
            "success": false,
            "error": {
                "code": "INVALID_SAVINGS_TARGET",
                "message": "Savings target exceeds available income after fixed costs.",
                "meta": {"available": 3640000}
            }
        }
    """

    success: Literal_False = False
    error: StandardErrorDetail


# Trick to lock the literal without importing Literal into the class body twice.
from typing import Literal  # noqa: E402  (keep after re-exports)

Literal_False = Literal[False]
Literal_True  = Literal[True]


# ══════════════════════════════════════════════════════════════════════════════
# Nested sub-schemas used by SettingsHydrationResponse
# ══════════════════════════════════════════════════════════════════════════════

class CooldownMeta(BaseModel):
    """
    Lock-until timestamps surfaced to the frontend so it can disable UI
    controls without needing to know the underlying cooldown rules.
    """

    timezone_locked_until:  datetime | None = None
    username_locked_until:  datetime | None = None
    path_cooldown_until:    datetime | None = None


# ─── Profile ─────────────────────────────────────────────────────────────────

class ProfilePayload(BaseModel):
    """Identity and configuration fields from journey_profiles."""

    user_id:        UUID
    username:       str
    avatar_class:   str
    timezone:       str
    primary_payday: int | None = None
    setup_status:   str
    active_theme:   str


# ─── Progression ─────────────────────────────────────────────────────────────

class ProgressionPayload(BaseModel):
    """
    Live game state from player_state.
    Level is derived server-side: floor(sqrt(total_xp / 100)) + 1.
    """

    current_hp:     int
    total_xp:       int
    level:          int   = Field(description="Derived — never stored permanently.")
    current_gold:   float
    current_shield: float
    standby_tokens: int


# ─── Financials ──────────────────────────────────────────────────────────────

class FinancialsPayload(BaseModel):
    """
    Financial baseline and the derived daily budget.

    fixed_costs is the live sum of active fixed-category transactions and
    outstanding loan instalments — NOT a stored column.
    """

    expected_monthly_income:    float
    monthly_savings_target:     float
    fixed_costs:                float = Field(
        description="Runtime sum: active fixed categories + loan instalments."
    )
    projected_safe_daily_budget: float = Field(
        description="(income - fixed_costs - savings_target) / 30"
    )


# ─── Preferences ─────────────────────────────────────────────────────────────

class AppPreferencesPayload(BaseModel):
    """Materialised view of the app_preferences JSONB column."""

    theme:          str  = "clear-night"
    reduced_motion: bool = False
    privacy_mode:   bool = False


class NotificationSettingsPayload(BaseModel):
    """Materialised view of the notification_settings JSONB column."""

    daily_reminder:               bool = True
    hazard_alerts:                bool = True
    achievement_notifications:    bool = True


# ─── Active path ─────────────────────────────────────────────────────────────

class ActivePathPayload(BaseModel):
    """Current journey path and its change metadata."""

    path_key:       str
    display_name:   str
    changed_at:     datetime | None = None
    cooldown_until: datetime | None = None


# ══════════════════════════════════════════════════════════════════════════════
# GET /settings/  —  Main hydration response
# ══════════════════════════════════════════════════════════════════════════════

class SettingsHydrationResponse(BaseModel):
    """
    Single-shot hydration payload for the Settings screen.

    The frontend hydrates this once on mount.  Cooldown metadata allows it
    to lock/disable relevant controls without any further API calls.

    Assembled by the service layer in three queries:
      1. SELECT from journey_profiles  (profile, preferences, notifications,
                                        cooldown timestamps)
      2. SELECT from player_state      (progression)
      3. Aggregate from categories + loans  (fixed_costs)
    """

    success: Literal_True = True

    meta:           CooldownMeta
    profile:        ProfilePayload
    progression:    ProgressionPayload
    financials:     FinancialsPayload
    preferences:    AppPreferencesPayload
    notifications:  NotificationSettingsPayload
    active_path:    ActivePathPayload


# ══════════════════════════════════════════════════════════════════════════════
# GET /settings/fixed-costs
# ══════════════════════════════════════════════════════════════════════════════

class FixedCostLineItem(BaseModel):
    """Single fixed-cost entry (category or loan instalment)."""

    id:             UUID
    name:           str
    source:         Literal["category", "loan"]
    amount:         float
    currency_code:  str = "IDR"


class FixedCostsResponse(BaseModel):
    """Breakdown modal payload for the fixed-costs drill-down."""

    success:    Literal_True = True
    items:      list[FixedCostLineItem]
    total:      float


# ══════════════════════════════════════════════════════════════════════════════
# PATCH /settings/profile  (success)
# ══════════════════════════════════════════════════════════════════════════════

class PatchProfileResponse(BaseModel):
    """
    Returned after a successful profile patch.
    Includes refreshed cooldown timestamps so the frontend can immediately
    re-lock the changed controls.
    """

    success:    Literal_True = True
    profile:    ProfilePayload
    meta:       CooldownMeta


# ══════════════════════════════════════════════════════════════════════════════
# PATCH /settings/financials  (success)
# ══════════════════════════════════════════════════════════════════════════════

class PatchFinancialsResponse(BaseModel):
    """
    Returned after a successful financials patch.
    The recalculated daily budget is surfaced immediately.
    """

    success:                    Literal_True = True
    financials:                 FinancialsPayload


# ══════════════════════════════════════════════════════════════════════════════
# PATCH /settings/preferences  (success)
# ══════════════════════════════════════════════════════════════════════════════

class PatchPreferencesResponse(BaseModel):
    success:        Literal_True = True
    preferences:    AppPreferencesPayload


# ══════════════════════════════════════════════════════════════════════════════
# PATCH /settings/notifications  (success)
# ══════════════════════════════════════════════════════════════════════════════

class PatchNotificationsResponse(BaseModel):
    success:        Literal_True = True
    notifications:  NotificationSettingsPayload


# ══════════════════════════════════════════════════════════════════════════════
# POST /settings/path/change  (success)
# ══════════════════════════════════════════════════════════════════════════════

class PathChangeResponse(BaseModel):
    """
    Returned after a successful path switch.
    Includes the new cooldown deadline so the frontend can disable the
    change-path button immediately.
    """

    success:        Literal_True  = True
    active_path:    ActivePathPayload
    event_id:       UUID = Field(description="game_events row ID for PATH_CHANGED.")


# ══════════════════════════════════════════════════════════════════════════════
# POST /settings/reset-progress  (success)
# ══════════════════════════════════════════════════════════════════════════════

class ResetProgressResponse(BaseModel):
    """
    Returned after a successful progression reset.

    Preservation contract (enforced by service layer):
      - Inventory (shields, standby tokens) is NOT cleared.
      - Financial ledger (transactions, wallets, categories) is NOT touched.
    """

    success:        Literal_True  = True
    progression:    ProgressionPayload   = Field(
        description="Freshly reset state: HP=100, XP=0, level=1."
    )
    event_id:       UUID = Field(description="game_events row ID for PROGRESS_RESET.")


# ══════════════════════════════════════════════════════════════════════════════
# GET /account/export  —  Data export (not streamed; synchronous JSON)
# ══════════════════════════════════════════════════════════════════════════════

class ExportMetadata(BaseModel):
    """Top-level envelope wrapping the exported data download."""

    exported_at:        datetime
    user_id:            UUID
    transaction_count:  int
    event_count:        int
    journal_count:      int


class AccountExportResponse(BaseModel):
    """
    Full synchronous export payload.

    The service layer serialises transactions, journey_events, and
    journey_journal rows directly into this schema and returns it as a
    downloadable .json attachment.
    """

    success:        Literal_True = True
    meta:           ExportMetadata
    transactions:   list[dict[str, Any]]
    journey_events: list[dict[str, Any]]
    journey_journal: list[dict[str, Any]]


# ══════════════════════════════════════════════════════════════════════════════
# DELETE /account  (success acknowledgement only — DB cascade handles the rest)
# ══════════════════════════════════════════════════════════════════════════════

class AccountDeleteResponse(BaseModel):
    success:    Literal_True = True
    message:    str = "Account and all associated data have been permanently deleted."


# ══════════════════════════════════════════════════════════════════════════════
# Union types for router return annotations
# ══════════════════════════════════════════════════════════════════════════════

SettingsHydrationResult    = SettingsHydrationResponse    | SettingsErrorEnvelope
PatchProfileResult         = PatchProfileResponse         | SettingsErrorEnvelope
PatchFinancialsResult      = PatchFinancialsResponse      | SettingsErrorEnvelope
PatchPreferencesResult     = PatchPreferencesResponse     | SettingsErrorEnvelope
PatchNotificationsResult   = PatchNotificationsResponse   | SettingsErrorEnvelope
PathChangeResult           = PathChangeResponse           | SettingsErrorEnvelope
ResetProgressResult        = ResetProgressResponse        | SettingsErrorEnvelope

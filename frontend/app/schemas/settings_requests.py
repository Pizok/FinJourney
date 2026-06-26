"""
settings_requests.py
────────────────────
Pydantic v2 request schemas for the FinJourney Settings & Account Management
module.  Every schema maps 1-to-1 with an API endpoint defined in
api_contract.md / settings_backend.md.

Design rules:
  - All fields are explicitly typed; no implicit Any.
  - Validators enforce backend guardrails at the edge so the service layer
    can trust the input and focus purely on database operations.
  - Error-code literals are defined once here and re-exported from
    settings_responses.py so callers have a single import surface.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator


# ══════════════════════════════════════════════════════════════════════════════
# Standardised error code literals
# ══════════════════════════════════════════════════════════════════════════════

class SettingsErrorCode:
    """
    Exhaustive set of machine-readable error codes returned by this domain.
    Use as the ``code`` field of a standard error envelope.
    """

    TIMEZONE_LOCKED:            Literal["TIMEZONE_LOCKED"]            = "TIMEZONE_LOCKED"
    PATH_CHANGE_LOCKED:         Literal["PATH_CHANGE_LOCKED"]         = "PATH_CHANGE_LOCKED"
    PATH_ALREADY_ACTIVE:        Literal["PATH_ALREADY_ACTIVE"]        = "PATH_ALREADY_ACTIVE"
    INVALID_SAVINGS_TARGET:     Literal["INVALID_SAVINGS_TARGET"]     = "INVALID_SAVINGS_TARGET"
    USERNAME_ALREADY_EXISTS:    Literal["USERNAME_ALREADY_EXISTS"]    = "USERNAME_ALREADY_EXISTS"
    USERNAME_CHANGE_LOCKED:     Literal["USERNAME_CHANGE_LOCKED"]     = "USERNAME_CHANGE_LOCKED"
    INVALID_PAYDAY:             Literal["INVALID_PAYDAY"]             = "INVALID_PAYDAY"


SettingsErrorCodeLiteral = Literal[
    "TIMEZONE_LOCKED",
    "PATH_CHANGE_LOCKED",
    "PATH_ALREADY_ACTIVE",
    "INVALID_SAVINGS_TARGET",
    "USERNAME_ALREADY_EXISTS",
    "USERNAME_CHANGE_LOCKED",
    "INVALID_PAYDAY",
]


# ══════════════════════════════════════════════════════════════════════════════
# PATCH /settings/profile
# ══════════════════════════════════════════════════════════════════════════════

class PatchProfileRequest(BaseModel):
    """
    Partial update for identity / scheduling fields.

    All fields are individually optional so the client may send only the
    subset it intends to change.  At least one field must be present.
    """

    username: Annotated[
        str | None,
        Field(
            default=None,
            min_length=3,
            max_length=32,
            pattern=r"^[a-zA-Z0-9_\-]+$",
            description=(
                "Alphanumeric username (letters, digits, underscores, hyphens). "
                "Subject to 30-day change cooldown enforced by the service layer."
            ),
        ),
    ] = None

    timezone: Annotated[
        str | None,
        Field(
            default=None,
            min_length=1,
            max_length=64,
            description=(
                "IANA timezone identifier, e.g. 'Asia/Jakarta'. "
                "Subject to 30-day change cooldown enforced by the service layer."
            ),
        ),
    ] = None



    avatar_key: Annotated[
        str | None,
        Field(
            default=None,
            description="Avatar character selection ('Roan' or 'Lyss').",
        ),
    ] = None

    @model_validator(mode="after")
    def at_least_one_field_present(self) -> "PatchProfileRequest":
        if all(v is None for v in (self.username, self.timezone, self.avatar_key)):
            raise ValueError(
                "At least one of 'username', 'timezone', or 'avatar_key' must be provided."
            )
        return self


# ══════════════════════════════════════════════════════════════════════════════
# PATCH /settings/financials
# ══════════════════════════════════════════════════════════════════════════════

class PatchFinancialsRequest(BaseModel):
    """
    Update the user's financial baseline figures.

    The service layer must re-validate that savings_target does not exceed
    (income - fixed_costs) and must return INVALID_SAVINGS_TARGET if it does.
    """

    expected_monthly_income: Annotated[
        float | None,
        Field(
            default=None,
            ge=0,
            description="Gross monthly income in the user's base currency unit.",
        ),
    ] = None

    monthly_savings_target: Annotated[
        float | None,
        Field(
            default=None,
            ge=0,
            description=(
                "Monthly savings commitment. "
                "Must not exceed (income − fixed_costs); "
                "the service returns INVALID_SAVINGS_TARGET if it does."
            ),
        ),
    ] = None

    @model_validator(mode="after")
    def at_least_one_field_present(self) -> "PatchFinancialsRequest":
        if self.expected_monthly_income is None and self.monthly_savings_target is None:
            raise ValueError(
                "At least one of 'expected_monthly_income' or 'monthly_savings_target' must be provided."
            )
        return self


# ══════════════════════════════════════════════════════════════════════════════
# PATCH /settings/preferences
# ══════════════════════════════════════════════════════════════════════════════

class PatchPreferencesRequest(BaseModel):
    """
    Update UI / accessibility preferences stored in ``app_preferences`` JSONB.
    """

    theme: Annotated[
        str | None,
        Field(
            default=None,
            min_length=1,
            max_length=64,
            description=(
                "Theme key from theme_registry, e.g. 'clear-night'. "
                "The service layer validates the key exists and is unlocked."
            ),
        ),
    ] = None

    reduced_motion: Annotated[
        bool | None,
        Field(
            default=None,
            description="When True, suppress non-essential animations.",
        ),
    ] = None

    privacy_mode: Annotated[
        bool | None,
        Field(
            default=None,
            description="When True, mask financial figures behind blur overlays.",
        ),
    ] = None

    @model_validator(mode="after")
    def at_least_one_field_present(self) -> "PatchPreferencesRequest":
        if all(v is None for v in (self.theme, self.reduced_motion, self.privacy_mode)):
            raise ValueError("At least one preference field must be provided.")
        return self


# ══════════════════════════════════════════════════════════════════════════════
# PATCH /settings/notifications
# ══════════════════════════════════════════════════════════════════════════════

class PatchNotificationsRequest(BaseModel):
    """
    Update notification opt-in flags stored in ``notification_settings`` JSONB.
    """

    daily_reminder: Annotated[
        bool | None,
        Field(
            default=None,
            description="Enable the 20:00 local-time inactivity reminder.",
        ),
    ] = None

    hazard_alerts: Annotated[
        bool | None,
        Field(
            default=None,
            description="Enable push/email alerts when a hazard (e.g. debt bleed) activates.",
        ),
    ] = None

    achievement_notifications: Annotated[
        bool | None,
        Field(
            default=None,
            description="Enable notifications when an achievement or level-up fires.",
        ),
    ] = None

    @model_validator(mode="after")
    def at_least_one_field_present(self) -> "PatchNotificationsRequest":
        if all(
            v is None
            for v in (self.daily_reminder, self.hazard_alerts, self.achievement_notifications)
        ):
            raise ValueError("At least one notification field must be provided.")
        return self


# ══════════════════════════════════════════════════════════════════════════════
# POST /settings/path/change
# ══════════════════════════════════════════════════════════════════════════════

class PathChangeRequest(BaseModel):
    """
    Switch the player's active journey path (avatar class / play style).

    Guardrails enforced by the service layer:
    - new_path must differ from the current active_path  → PATH_ALREADY_ACTIVE
    - 180-day cooldown must have expired                 → PATH_CHANGE_LOCKED
    """

    new_path: Annotated[
        str,
        Field(
            min_length=1,
            max_length=64,
            description=(
                "Slug of the desired journey path, e.g. 'sentinel', 'navigator'. "
                "Must match a valid path key in the path registry."
            ),
        ),
    ]


# ══════════════════════════════════════════════════════════════════════════════
# POST /settings/reset-progress
# ══════════════════════════════════════════════════════════════════════════════

_RESET_CONFIRMATION_TOKEN: Literal["RESET"] = "RESET"


class ResetProgressRequest(BaseModel):
    """
    Irreversible progression reset.

    The client MUST send ``{"confirmation": "RESET"}`` exactly.
    The service layer will:
      - Reset HP to 100, XP/level to 0/1.
      - Archive active challenges and region progress.
      - Preserve inventory (shields, standby tokens) and the financial ledger.
      - Publish a PROGRESS_RESET game_event.
    """

    confirmation: Annotated[
        Literal["RESET"],
        Field(
            description=(
                "Must be the exact string 'RESET'. "
                "Any other value is rejected at schema validation time."
            ),
        ),
    ]

"""
register: backend_logic
domain: Identity & Setup
module: Authentication & Profile Initialization

Pydantic *request* schemas for the Core Identity Endpoints:
    PATCH /api/v1/profile/setup
"""

from __future__ import annotations

import re
from enum import Enum
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, Field, field_validator

# Lowercase letters, digits, underscores only — 3 to 20 characters.
USERNAME_PATTERN = re.compile(r"^[a-z0-9_]{3,20}$")


class AvatarPath(str, Enum):
    """Selectable progression path / avatar class, locked for 6 months after setup."""

    SENTINEL = "SENTINEL"
    CATALYST = "CATALYST"
    PHANTOM = "PHANTOM"


class ProfileSetupRequest(BaseModel):
    """
    Body for PATCH /api/v1/profile/setup

    Finalizes onboarding: sets the permanent username, locks in the avatar
    path, and records the user's timezone (used for all account_day /
    scheduler logic downstream).
    """

    username: str = Field(
        ...,
        min_length=3,
        max_length=20,
        description=(
            "Lowercase letters, numbers, and underscores only. "
            "Must be globally unique across journey_profiles."
        ),
        examples=["pi"],
    )
    active_path: AvatarPath = Field(
        ...,
        description="Selected avatar class / progression path. Locked for 6 months.",
        examples=["SENTINEL"],
    )
    timezone: str = Field(
        ...,
        description="IANA timezone identifier used for account_day calculations.",
        examples=["Asia/Jakarta"],
    )

    @field_validator("username")
    @classmethod
    def validate_username_format(cls, value: str) -> str:
        if not USERNAME_PATTERN.match(value):
            raise ValueError(
                "username must be 3-20 characters long and contain only "
                "lowercase letters, numbers, and underscores"
            )
        return value

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError(f"'{value}' is not a valid IANA timezone") from exc
        return value

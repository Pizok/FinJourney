"""
register: backend_logic
domain: Identity & Setup
module: Authentication & Profile Initialization

Pydantic *response* schemas for the Core Identity Endpoints:
    GET   /api/v1/auth/session
    PATCH /api/v1/profile/setup
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SessionResponse(BaseModel):
    """
    Response for GET /api/v1/auth/session

    Lightweight auth/setup-state check used by frontend middleware /
    root layout — intentionally does not include heavy dashboard data.
    """

    authenticated: bool = Field(..., examples=[True])
    user_id: UUID = Field(
        ..., examples=["3f2a9c1e-2b1d-4d6a-9f0a-1c2d3e4f5a6b"]
    )
    has_completed_setup: bool = Field(..., examples=[False])
    generated_at: datetime = Field(
        ...,
        description="Timezone-aware server timestamp at which this response was generated.",
        examples=["2026-06-18T23:08:09Z"],
    )


class ProfileSetupResponse(BaseModel):
    """
    Response for PATCH /api/v1/profile/setup

    Used for both the successful first-time completion and the idempotent
    retry path (when has_completed_setup was already true).
    """

    setup_completed: bool = Field(..., examples=[True])
    message: str = Field(
        ...,
        examples=[
            "Profile initialized successfully.",
            "Profile already initialized.",
        ],
    )

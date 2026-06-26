"""
category.py — Pydantic schemas for the Category resource.

Categories are global per user (not duplicated per wallet).
monthly_limit is stored and validated exclusively as integer cents.
A limit of 0 means the category is untracked (no cap enforced).
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class CategoryCreate(BaseModel):
    """
    Payload for POST /api/v1/categories.

    Rules
    -----
    * name          — non-empty after stripping; max 64 chars; unique per user
                      (uniqueness enforced at the DB layer via UNIQUE constraint).
    * monthly_limit — optional spending cap in integer cents; must be ≥ 0.
                      Omitting it (or passing 0) means no cap is enforced.
    """

    name: str = Field(..., min_length=1, max_length=64)
    monthly_limit: int = Field(
        default=0,
        ge=0,
        description="Monthly spending cap in integer cents. 0 = uncapped.",
    )

    @field_validator("name", mode="before")
    @classmethod
    def strip_and_check_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Category name cannot be blank.")
        return stripped


class CategoryUpdate(BaseModel):
    """
    Payload for PATCH /api/v1/categories/{id}.

    Both fields are optional; omitted fields remain unchanged.
    At least one must be provided.
    """

    name: Optional[str] = Field(default=None, min_length=1, max_length=64)
    monthly_limit: Optional[int] = Field(
        default=None,
        ge=0,
        description="Updated monthly spending cap in integer cents. 0 = uncapped.",
    )

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        stripped = v.strip()
        if not stripped:
            raise ValueError("Category name cannot be blank.")
        return stripped

    def model_post_init(self, __context: object) -> None:  # noqa: ANN001
        if self.name is None and self.monthly_limit is None:
            raise ValueError(
                "At least one field (name, monthly_limit) must be provided."
            )


# ---------------------------------------------------------------------------
# Response schema
# ---------------------------------------------------------------------------

class CategoryOut(BaseModel):
    """
    Outbound category representation.

    monthly_limit is returned in integer cents.
    The frontend must not derive spending figures from this value;
    those are computed and returned by the wallet summary endpoint.
    """

    id: UUID
    user_id: UUID
    name: str
    monthly_limit: int = Field(
        default=0,
        description="Monthly spending cap in integer cents. 0 = uncapped."
    )
    created_at: datetime

    model_config = {"from_attributes": True}

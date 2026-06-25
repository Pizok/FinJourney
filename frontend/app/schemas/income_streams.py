"""
app/schemas/income_streams.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pydantic v2 schemas for the IncomeStream resource.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

class IncomeStreamCreate(BaseModel):
    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Name of the income stream, e.g. 'Primary Salary'",
    )
    amount: int = Field(
        ...,
        gt=0,
        description="Monthly income amount in IDR",
    )

class IncomeStreamUpdate(BaseModel):
    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    amount: Optional[int] = Field(
        default=None,
        gt=0,
    )

class IncomeStreamResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    amount: int
    created_at: datetime
    deleted_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

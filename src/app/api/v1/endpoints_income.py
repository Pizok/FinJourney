"""
app/api/v1/endpoints_income.py
"""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.v1.dependencies import AuthUser, DBClient
from app.schemas.income_streams import (
    IncomeStreamCreate,
    IncomeStreamResponse,
    IncomeStreamUpdate,
)

router = APIRouter(prefix="/income-streams", tags=["income_streams"])


@router.get("", response_model=list[IncomeStreamResponse])
async def list_income_streams(user: AuthUser, db: DBClient) -> Any:
    response = await (
        db.table("income_streams")
        .select("*")
        .eq("user_id", user.user_id)
        .is_("deleted_at", "null")
        .order("created_at")
        .execute()
    )
    return response.data


@router.post("", response_model=IncomeStreamResponse, status_code=status.HTTP_201_CREATED)
async def create_income_stream(
    payload: IncomeStreamCreate, user: AuthUser, db: DBClient
) -> Any:
    row_data = payload.model_dump(mode="json")
    row_data["user_id"] = user.user_id
    response = await db.table("income_streams").insert(row_data).execute()

    return response.data[0]


@router.patch("/{stream_id}", response_model=IncomeStreamResponse)
async def update_income_stream(
    stream_id: UUID, payload: IncomeStreamUpdate, user: AuthUser, db: DBClient
) -> Any:
    updates = payload.model_dump(exclude_unset=True, mode="json")
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update.",
        )

    response = await (
        db.table("income_streams")
        .update(updates)
        .eq("id", str(stream_id))
        .eq("user_id", user.user_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Income stream not found")

    return response.data[0]


@router.delete("/{stream_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_income_stream(stream_id: UUID, user: AuthUser, db: DBClient) -> None:
    response = await (
        db.table("income_streams")
        .update({"deleted_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", str(stream_id))
        .eq("user_id", user.user_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Income stream not found")

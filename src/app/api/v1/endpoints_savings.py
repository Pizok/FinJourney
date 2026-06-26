"""
app/api/v1/endpoints_savings.py
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.v1.dependencies import AuthUser, DBClient
from app.schemas.savings_targets import (
    LogSavingsRequest,
    LogSavingsResponse,
    SavingsTargetCreate,
    SavingsTargetOut,
    SavingsTargetUpdate,
)
from app.services.savings_service import log_savings, recalculate_scalars

router = APIRouter(prefix="/savings-targets", tags=["savings_targets"])


@router.get("", response_model=list[SavingsTargetOut])
async def list_savings_targets(user: AuthUser, db: DBClient) -> Any:
    response = await (
        db.table("savings_targets")
        .select("*")
        .eq("user_id", user.user_id)
        .is_("deleted_at", "null")
        .order("deadline")
        .execute()
    )
    return response.data


@router.post("", response_model=SavingsTargetOut, status_code=status.HTTP_201_CREATED)
async def create_savings_target(
    payload: SavingsTargetCreate, user: AuthUser, db: DBClient
) -> Any:
    row_data = payload.model_dump(mode="json")
    row_data["user_id"] = user.user_id
    response = await db.table("savings_targets").insert(row_data).execute()
    
    # Trigger scalar recalculation
    await recalculate_scalars(db, user.user_id)
    return response.data[0]


@router.patch("/{target_id}", response_model=SavingsTargetOut)
async def update_savings_target(
    target_id: UUID, payload: SavingsTargetUpdate, user: AuthUser, db: DBClient
) -> Any:
    updates = payload.model_dump(exclude_unset=True, mode="json")
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update.",
        )

    response = await (
        db.table("savings_targets")
        .update(updates)
        .eq("id", str(target_id))
        .eq("user_id", user.user_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Savings target not found")

    # Trigger scalar recalculation
    await recalculate_scalars(db, user.user_id)
    return response.data[0]


@router.delete("/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_savings_target(target_id: UUID, user: AuthUser, db: DBClient) -> None:
    from datetime import datetime, timezone
    now_utc = datetime.now(timezone.utc).isoformat()
    response = await (
        db.table("savings_targets")
        .update({"deleted_at": now_utc})
        .eq("id", str(target_id))
        .eq("user_id", user.user_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Savings target not found")

    # Trigger scalar recalculation
    await recalculate_scalars(db, user.user_id)


@router.post("/{target_id}/log", response_model=LogSavingsResponse)
async def log_savings_endpoint(
    target_id: UUID, payload: LogSavingsRequest, user: AuthUser, db: DBClient
) -> Any:
    updated_target = await log_savings(
        client=db,
        user_id=user.user_id,
        target_id=str(target_id),
        amount=payload.amount,
        wallet_id=str(payload.wallet_id),
        note=payload.note,
    )
    
    # Note: log_savings only impacts the current_amount, 
    # not the monthly_contribution, so recalculate_scalars is not strictly needed.
    
    return {
        "success": True,
        "data": updated_target
    }

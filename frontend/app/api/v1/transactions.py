from fastapi import APIRouter, HTTPException, Query, status

from app.api.v1.dependencies import CurrentUser, DbClient
from app.db.queries.profile_queries import fetch_player_state, fetch_profile
from app.schemas.transaction import TransactionCreate
from app.services.transaction_service import (
    create_transaction,
    delete_transaction,
    list_transactions,
)

router = APIRouter()


@router.get("/transactions", summary="List transactions")
async def get_transactions(
    user: CurrentUser,
    db: DbClient,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    wallet_id: str | None = Query(default=None),
    category_id: str | None = Query(default=None),
    type: str | None = Query(default=None),
):
    data = await list_transactions(
        db=db,
        user_id=user["id"],
        limit=limit,
        offset=offset,
        wallet_id=wallet_id,
        category_id=category_id,
        tx_type=type,
    )
    return {"success": True, "data": data}


@router.post(
    "/transactions",
    status_code=status.HTTP_201_CREATED,
    summary="Log a transaction",
)
async def post_transaction(
    user: CurrentUser,
    db: DbClient,
    payload: TransactionCreate,
):
    """
    Inserts the record, recalculates the daily budget, applies Daily Bleed
    if the user is over budget, and appends all state changes to game_events.
    Returns the created transaction alongside the updated player state.
    """
    profile = await fetch_profile(db, user["id"])
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")

    player_state = await fetch_player_state(db, user["id"])
    if not player_state:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player state not found.")

    result = await create_transaction(
        db=db,
        user_id=user["id"],
        user_tz=profile.get("timezone", "UTC"),
        player_state=player_state,
        payload=payload,
    )
    return {"success": True, "data": result}


@router.delete("/transactions/{tx_id}", summary="Soft-delete a transaction")
async def remove_transaction(user: CurrentUser, db: DbClient, tx_id: str):
    result = await delete_transaction(db, tx_id, user["id"])
    if not result.get("found"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found or already deleted.",
        )
    return {"success": True, "data": {"deleted": True, "id": tx_id}}

from fastapi import APIRouter, HTTPException, status

from app.api.v1.dependencies import AuthUser, DbClient
from app.services.bootstrap_service import build_bootstrap_payload

router = APIRouter()


@router.get("/me/bootstrap", summary="Dashboard hydration")
async def bootstrap(user: AuthUser, db: DbClient):
    """
    Single endpoint called after login.
    Aggregates profile, player state, daily status, wallets, categories,
    tasks, active region, and feature unlocks in one parallel round-trip.
    """
    try:
        data = await build_bootstrap_payload(db, user.user_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    return {"success": True, "data": data}

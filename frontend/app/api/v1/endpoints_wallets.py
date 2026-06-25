"""
app/api/v1/endpoints/wallets.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FastAPI router for the Wallets feature.

This file is an UPDATE to the existing wallets.py.
Only the new `POST /wallets/rebalance-budget` endpoint is shown in full
below. Pre-existing routes (GET /wallets, POST /wallets, PATCH /wallets/{id},
DELETE /wallets/{id}) are retained as stubs to show correct placement of the
new route within the router.

New route
─────────
  POST /wallets/rebalance-budget
      Applies one or more category monthly-limit adjustments atomically.
      This is the write-side counterpart to the analytics advisory payload:
      Analytics recommends; this endpoint commits.

      The analytics module is strictly read-only (analytics_backend.md
      § Read-Only Boundary) — mutations always belong here in wallet_service.

Error handling
──────────────
  category_not_found → 422 Unprocessable Entity
      One or more category IDs did not pass ownership validation.
      Returns the standard error envelope so the frontend can display
      which categories failed.

  Other ValueError    → re-raised for the global exception handler.
"""

from __future__ import annotations


from fastapi import APIRouter, Depends, HTTPException, status

from app.core.constants import ErrorCode
from app.api.v1.dependencies import AuthUser, DbClient
from app.schemas.wallet import RebalanceBudgetRequest, WalletCreate, WalletOut, WalletBootstrapResponse
from app.services import wallet_service

router = APIRouter(prefix="/wallets", tags=["wallets"])


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# EXISTING ROUTES  (stubs — do not modify)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@router.get(
    "",
    response_model=dict,
    summary="List all wallets",
)
async def list_wallets(
    user: AuthUser,
    db:   DbClient,
) -> dict:
    """Return all active wallets for the authenticated user."""
    wallets = await wallet_service.get_wallets(db, user.user_id)
    return {"success": True, "data": wallets}


@router.post(
    "",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    summary="Create a wallet (Level 3+)",
)
async def create_wallet(
    body: WalletCreate,
    user: AuthUser,
    db:   DbClient,
) -> dict:
    """Create a new wallet. Requires Level 3+."""
    wallet = await wallet_service.create_wallet(db, user.user_id, body)
    return {"success": True, "data": wallet}


@router.patch(
    "/{wallet_id}",
    response_model=dict,
    summary="Update a wallet",
)
async def update_wallet(
    wallet_id: str,
    body: dict,
    user: AuthUser,
    db:   DbClient,
) -> dict:
    """Update a wallet's settings."""
    try:
        wallet = await wallet_service.update_wallet(db, wallet_id, user.user_id, body)
        return {"success": True, "data": wallet}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": {"code": "update_failed", "message": str(e)}}
        )

@router.delete(
    "/{wallet_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a wallet",
)
async def delete_wallet(
    wallet_id: str,
    user: AuthUser,
    db:   DbClient,
):
    """Soft-delete a wallet. Fails if transactions exist."""
    try:
        await wallet_service.delete_wallet(db, wallet_id, user.user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"success": False, "error": {"code": "wallet_has_transactions", "message": str(e)}}
        )


@router.get(
    "/bootstrap",
    response_model=dict,
    summary="Wallet page hydration",
)
async def get_wallet_bootstrap(
    user: AuthUser,
    db: DbClient,
) -> dict:
    """Returns the consolidated payload for the Finance page."""
    import asyncio

    # Execute all queries concurrently
    wallets_task = db.table("wallets").select("*").eq("user_id", str(user.user_id)).is_("deleted_at", "null").execute()
    categories_task = db.table("categories").select("*").eq("user_id", str(user.user_id)).is_("deleted_at", "null").execute()
    transactions_task = db.table("transactions").select("*").eq("user_id", str(user.user_id)).eq("status", "active").order("transaction_date", desc=True).limit(20).execute()
    fixed_expenses_task = db.table("fixed_expenses").select("*").eq("user_id", str(user.user_id)).execute()
    loans_task = db.table("loans").select("*").eq("user_id", str(user.user_id)).eq("status", "ACTIVE").execute()
    profile_task = db.table("journey_profiles").select("expected_monthly_income, monthly_savings_target").eq("id", str(user.user_id)).execute()

    wallets, categories, transactions, fixed_expenses, loans, profile = await asyncio.gather(
        wallets_task,
        categories_task,
        transactions_task,
        fixed_expenses_task,
        loans_task,
        profile_task,
    )

    profile_data = profile.data[0] if profile.data else None

    financial_assumptions = {
        "expected_monthly_income": profile_data["expected_monthly_income"] if profile_data and profile_data.get("expected_monthly_income") else 0,
        "monthly_savings_target": profile_data["monthly_savings_target"] if profile_data and profile_data.get("monthly_savings_target") else 0,
    }

    data = WalletBootstrapResponse(
        wallets=wallets.data if wallets.data else [],
        category_limits=categories.data if categories.data else [],
        recent_transactions=transactions.data if transactions.data else [],
        fixed_expenses=fixed_expenses.data if fixed_expenses.data else [],
        active_loans=loans.data if loans.data else [],
        financial_assumptions=financial_assumptions,
    ).model_dump(mode="json")

    return {"success": True, "data": data}



# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NEW: POST /wallets/rebalance-budget
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@router.post(
    "/rebalance-budget",
    summary="Apply category budget adjustments",
    description=(
        "Atomically applies one or more category monthly-limit adjustments. "
        "Builds on the analytics advisory: the frontend converts "
        "`Advisory.suggested_actions[].reduction_amount` offsets into absolute "
        "`new_monthly_limit` values before calling this endpoint. "
        "All adjustments are committed in a single database transaction; "
        "a partial failure rolls back the entire operation. "
        "Each successful rebalance appends an immutable audit event to `game_events`."
    ),
    responses={
        200: {
            "description": "All adjustments applied successfully.",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "adjusted_count": 2,
                            "adjustments": [
                                {
                                    "category_id": "uuid",
                                    "category_name": "Food",
                                    "old_limit": 750000,
                                    "new_limit": 450000,
                                },
                                {
                                    "category_id": "uuid",
                                    "category_name": "Transport",
                                    "old_limit": 300000,
                                    "new_limit": 250000,
                                },
                            ],
                        },
                    }
                }
            },
        },
        422: {
            "description": (
                "One or more category IDs failed ownership validation "
                "or the adjustments list is empty."
            ),
            "content": {
                "application/json": {
                    "example": {
                        "success": False,
                        "error": {
                            "code": "category_not_found",
                            "message": (
                                "One or more categories were not found or "
                                "do not belong to the current user."
                            ),
                        },
                    }
                }
            },
        },
    },
)
async def rebalance_budget(
    body: RebalanceBudgetRequest,
    user: AuthUser,
    db:   DbClient,
) -> dict:
    """
    Apply atomic category budget adjustments and write an audit event.

    The wallet_service validates ownership of all category IDs in a single
    query before any UPDATE is executed. A failure on any category rolls
    back the entire transaction.

    Returns a summary of all applied adjustments including the old and new
    limit values for each category, which the frontend can use for
    optimistic UI updates or undo functionality.
    """
    try:
        result = await wallet_service.rebalance_budget(
            db,
            user_id=user.user_id,
            payload=body,
        )
    except ValueError as exc:
        error_str = str(exc)

        if "category_not_found" in error_str:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "success": False,
                    "error": {
                        "code": ErrorCode.CATEGORY_NOT_FOUND.value,
                        "message": (
                            "One or more categories were not found or "
                            "do not belong to the current user."
                        ),
                    },
                },
            )

        # Unexpected ValueError — propagate for the global handler.
        raise

    return {"success": True, "data": result}

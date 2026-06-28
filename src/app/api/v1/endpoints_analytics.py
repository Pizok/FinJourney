"""
app/api/v1/endpoints/analytics.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FastAPI router for the Analytics feature.

Routes
──────
  GET  /analytics/overview?timeframe={val}   — full dashboard payload
  POST /analytics/simulate-loan              — stateless loan projection

Design notes
────────────
Level gate
    The payload is returned with HTTP 200 even when the user has not yet
    reached Level 3. The unlock_status block in the response body carries
    unlocked=False and xp_remaining so the frontend can render the locked
    state with XP progress. A 403 would prevent the frontend from showing
    the gate UI at all.

Stateless simulate-loan
    This endpoint intentionally has no database dependency. The request body
    is validated by Pydantic, passed to scoring_service pure-math functions,
    and returned. No DB connection is injected. This keeps latency minimal
    and allows unauthenticated access if rate-limiting is the only concern
    (currently requires auth for consistency, but can be relaxed).

Error envelope
    All errors follow the api_contract.md standard:
        {"success": false, "error": {"code": "...", "message": "..."}}
    FastAPI's default validation errors are re-wrapped via an exception
    handler registered in the main app; this router raises HTTPException
    with detail dicts that conform to the same shape.
"""

from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.constants import (
    DEFAULT_TIMEZONE,
    DEBT_PROJECTION_MAX_MONTHS,
    ErrorCode,
    VALID_TIMEFRAMES,
)
from app.api.v1.dependencies import AuthUser, DbClient
from app.schemas.analytics import (
    AnalyticsOverviewResponse,
    RebalanceBudgetPayload,
    SavingsTargetPayload,
    SimulateLoanRequest,
    SimulateLoanResponse,
)
from app.schemas.wallet import CategoryBudgetAdjustment, RebalanceBudgetRequest
from app.services import analytics_service, wallet_service
from app.db.queries import category_queries, savings_targets_queries

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GET /analytics/overview
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@router.get(
    "/overview",
    response_model=AnalyticsOverviewResponse,
    summary="Get analytics overview",
    description=(
        "Returns the full analytics dashboard payload for the authenticated user. "
        "Requires Level 3+; the payload is still returned at lower levels with "
        "`unlock_status.unlocked = false` so the frontend can render the gate UI. "
        "Valid timeframe values: `1w`, `1m`, `1y`, `all`."
    ),
    responses={
        200: {"description": "Analytics payload assembled successfully."},
        400: {
            "description": "Invalid timeframe parameter.",
            "content": {
                "application/json": {
                    "example": {
                        "success": False,
                        "error": {
                            "code": "invalid_timeframe",
                            "message": "timeframe must be one of: 1w, 1m, 1y, all",
                        },
                    }
                }
            },
        },
    },
)
async def get_analytics_overview(
    user: AuthUser,
    db:   DbClient,
    timeframe: Annotated[
        str,
        Query(
            description=(
                "Time window for the analytics data. "
                "One of: `1w` (7 days), `1m` (30 days), `1y` (365 days), `all` (max 5 years)."
            ),
            example="1m",
        ),
    ] = "1m",
) -> AnalyticsOverviewResponse:
    """
    Assemble and return the full analytics overview payload.

    The timeframe query parameter is validated before any DB call is made.
    An invalid value returns a structured 400 immediately.

    The service layer uses asyncio.gather() internally; this endpoint simply
    awaits the result and lets FastAPI serialise the Pydantic model.
    """
    # ── Timeframe validation ────────────────────────────────────────────────
    # Validate early — before acquiring a DB connection or running any query.
    if timeframe not in VALID_TIMEFRAMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": {
                    "code": ErrorCode.INVALID_TIMEFRAME.value,
                    "message": (
                        f"timeframe must be one of: "
                        f"{', '.join(sorted(VALID_TIMEFRAMES))}. "
                        f"Received: '{timeframe}'"
                    ),
                },
            },
        )

    # Timezone lives in the profile row — the service layer is responsible
    # for resolving it from the DB.  Pass DEFAULT_TIMEZONE as the fallback;
    # analytics_service.get_overview_payload accepts an optional tz override.
    user_tz: str = DEFAULT_TIMEZONE

    # ── Delegate to service ─────────────────────────────────────────────────
    try:
        payload = await analytics_service.get_overview_payload(
            db,
            user_id=user.user_id,
            timeframe_str=timeframe,
            user_tz=user_tz,
        )
    except ValueError as exc:
        # Service raises ValueError("invalid_timeframe") as a safety net for
        # any edge case that bypassed the guard above.
        if "invalid_timeframe" in str(exc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "error": {
                        "code": ErrorCode.INVALID_TIMEFRAME.value,
                        "message": (
                            "timeframe must be one of: "
                            f"{', '.join(sorted(VALID_TIMEFRAMES))}"
                        ),
                    },
                },
            )
        # Unexpected ValueError — let the global handler deal with it.
        raise

    return payload


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# POST /analytics/simulate-loan
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@router.post(
    "/simulate-loan",
    response_model=SimulateLoanResponse,
    summary="Simulate loan payoff projection",
    description=(
        "Stateless endpoint. Calculates a debt payoff projection from the "
        "supplied parameters without touching the database. "
        "When `annual_interest_rate` is omitted, a zero-interest straight-line "
        "projection is returned. When provided, a full amortisation calculation "
        "is applied and `total_interest_paid` is populated."
    ),
    responses={
        200: {"description": "Projection calculated successfully."},
        422: {"description": "Request body failed Pydantic validation."},
    },
)
async def simulate_loan(
    body: SimulateLoanRequest,
    # Auth still required — this endpoint belongs to the authenticated product surface.
    user: AuthUser,
    # Intentionally NO db dependency — this endpoint never touches the database.
) -> SimulateLoanResponse:
    """
    Stateless loan projection calculator.

    No database calls are made. All computation is performed in this handler
    using pure arithmetic. The result can be used by the frontend for
    "what-if" scenarios before the user commits to a rebalance.

    Two projection modes:
        Zero-interest (annual_interest_rate omitted):
            projected_months = ceil(remaining_debt / monthly_payment)
            total_interest_paid = None

        Amortisation (annual_interest_rate provided):
            Uses the standard amortisation formula to compute monthly
            payment count and total interest. Returns is_payable=False
            when the monthly_payment does not cover the first month's
            interest charge (the loan would never be paid off).
    """
    remaining_debt = body.remaining_debt
    monthly_payment = body.monthly_payment
    annual_rate = body.annual_interest_rate

    # ── Zero-interest path ─────────────────────────────────────────────────
    if annual_rate is None:
        projected_months = math.ceil(remaining_debt / monthly_payment)

        if projected_months > DEBT_PROJECTION_MAX_MONTHS:
            return SimulateLoanResponse(
                remaining_debt=remaining_debt,
                monthly_payment=monthly_payment,
                annual_interest_rate=None,
                is_payable=False,
                projected_months=None,
                debt_free_date=None,
                total_interest_paid=None,
            )

        debt_free_date = date.today() + timedelta(days=projected_months * 30)
        return SimulateLoanResponse(
            remaining_debt=remaining_debt,
            monthly_payment=monthly_payment,
            annual_interest_rate=None,
            is_payable=True,
            projected_months=projected_months,
            debt_free_date=debt_free_date,
            total_interest_paid=None,
        )

    # ── Amortisation path ──────────────────────────────────────────────────
    monthly_rate = annual_rate / 12.0

    # Guard: if monthly_payment ≤ first month's interest accrual, the loan
    # principal never decreases — the loan is unpayable.
    first_month_interest = math.floor(remaining_debt * monthly_rate)
    if monthly_payment <= first_month_interest:
        return SimulateLoanResponse(
            remaining_debt=remaining_debt,
            monthly_payment=monthly_payment,
            annual_interest_rate=annual_rate,
            is_payable=False,
            projected_months=None,
            debt_free_date=None,
            total_interest_paid=None,
        )

    # Standard amortisation formula:
    #   n = -log(1 - (r × P) / M) / log(1 + r)
    # where r = monthly_rate, P = principal, M = monthly_payment.
    #
    # We use math.log for precision; result is always finite when
    # monthly_payment > first_month_interest (validated above).
    n_exact = -(
        math.log(1.0 - (monthly_rate * remaining_debt) / monthly_payment)
        / math.log(1.0 + monthly_rate)
    )
    projected_months = math.ceil(n_exact)

    if projected_months > DEBT_PROJECTION_MAX_MONTHS:
        return SimulateLoanResponse(
            remaining_debt=remaining_debt,
            monthly_payment=monthly_payment,
            annual_interest_rate=annual_rate,
            is_payable=False,
            projected_months=None,
            debt_free_date=None,
            total_interest_paid=None,
        )

    total_paid = monthly_payment * projected_months
    total_interest_paid = max(0, total_paid - remaining_debt)
    debt_free_date = date.today() + timedelta(days=projected_months * 30)

    return SimulateLoanResponse(
        remaining_debt=remaining_debt,
        monthly_payment=monthly_payment,
        annual_interest_rate=annual_rate,
        is_payable=True,
        projected_months=projected_months,
        debt_free_date=debt_free_date,
        total_interest_paid=total_interest_paid,
    )





# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# POST /analytics/savings-target
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@router.post(
    "/savings-target",
    status_code=status.HTTP_200_OK,
    summary="Upsert savings target",
    description="Creates or updates the single active savings target for the user.",
)
async def upsert_savings_target(
    body: SavingsTargetPayload,
    user: AuthUser,
    db: DbClient,
):
    """
    Upserts the active savings target. If an active target exists, it is updated.
    Otherwise, a new active target is inserted.
    """
    import uuid
    # Check for an existing active target
    active_target = await savings_targets_queries.get_active_savings_targets(db, user_id=user.user_id)
    
    if active_target:
        # Update existing target
        updates = {
            "name": body.name,
            "target_amount": body.amount,
            "deadline": body.deadline.isoformat(),
        }
        await savings_targets_queries.update_savings_target(
            db, target_id=active_target["id"], user_id=user.user_id, updates=updates
        )
    else:
        # Insert new target
        await savings_targets_queries.insert_savings_target(
            db,
            user_id=user.user_id,
            name=body.name,
            target_amount=body.amount,
            deadline=body.deadline.isoformat(),
            priority=1,
            current_amount=0,
        )

    return {"success": True}

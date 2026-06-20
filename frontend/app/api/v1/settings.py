# FastAPI router for FinJourney Settings domain. Prefix: /api/v1/settings
# All journey.* imports severed; request schemas are inlined below.
# EventBus sourced from app.journey.engine.bus + app.journey.dependencies.

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.api.v1.dependencies import AuthUser, DbClient, get_current_user, get_db
from app.journey.engine.bus import EventBus
from app.journey.dependencies import get_event_bus
from app.services.setting_service import SettingsDomainError
from app.services import setting_service as settings_svc


from app.schemas.settings_requests import (
    PatchProfileRequest,
    PatchFinancialsRequest,
    PatchPreferencesRequest,
    PatchNotificationsRequest,
    PathChangeRequest,
    ResetProgressRequest,
)

# ══════════════════════════════════════════════════════════════════════════════
# Router
# ══════════════════════════════════════════════════════════════════════════════

router = APIRouter(
    prefix="/settings",
    tags=["Settings"],
)


# ══════════════════════════════════════════════════════════════════════════════
# Error conversion helper
# ══════════════════════════════════════════════════════════════════════════════

def _domain_error_to_response(exc: SettingsDomainError) -> JSONResponse:
    """
    Convert a SettingsDomainError into the standard JSON error envelope.

    Returns a plain-dict body so this file has zero dependency on
    journey.models response schemas.
    """
    return JSONResponse(
        status_code=exc.http_status,
        content={
            "success": False,
            "error": {
                "code":    exc.code,
                "message": exc.message,
                "meta":    exc.meta,
            },
        },
    )


# ══════════════════════════════════════════════════════════════════════════════
# GET /settings/
# Main hydration — called once on Settings screen mount.
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/",
    response_model=dict,
    summary="Hydrate the Settings screen",
    description=(
        "Returns the full settings payload in a single call: profile, "
        "progression, financials, preferences, notifications, active path, "
        "and cooldown lock metadata."
    ),
)
async def get_settings(
    user: AuthUser,
    db:   DbClient,
) -> dict[str, Any] | JSONResponse:
    try:
        result = await settings_svc.get_settings_hydration(db=db, user_id=user.user_id)
        # Service returns a Pydantic model or dict — normalise to dict for the wire.
        data = result.model_dump() if hasattr(result, "model_dump") else result
        return {"success": True, "data": data}
    except SettingsDomainError as exc:
        return _domain_error_to_response(exc)


# ══════════════════════════════════════════════════════════════════════════════
# GET /settings/fixed-costs
# Lazy-loaded breakdown for the fixed-costs drill-down modal.
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/fixed-costs",
    response_model=dict,
    summary="Get fixed-cost breakdown",
    description=(
        "Returns each active fixed category and loan instalment as a line item, "
        "plus the running total. Used by the fixed-costs drill-down modal."
    ),
)
async def get_fixed_costs(
    user: AuthUser,
    db:   DbClient,
) -> dict[str, Any] | JSONResponse:
    try:
        result = await settings_svc.get_fixed_costs(db=db, user_id=user.user_id)
        data = result.model_dump() if hasattr(result, "model_dump") else result
        return {"success": True, "data": data}
    except SettingsDomainError as exc:
        return _domain_error_to_response(exc)


# ══════════════════════════════════════════════════════════════════════════════
# PATCH /settings/profile
# Update username, timezone, and/or primary_payday.
# ══════════════════════════════════════════════════════════════════════════════

@router.patch(
    "/profile",
    response_model=dict,
    summary="Update profile fields",
    description=(
        "Partially updates username, timezone, and/or primary_payday. "
        "Username and timezone changes are subject to a 30-day cooldown. "
        "Username must be globally unique."
    ),
)
async def patch_profile(
    body: PatchProfileRequest,
    user: AuthUser,
    db:   DbClient,
) -> dict[str, Any] | JSONResponse:
    try:
        result = await settings_svc.patch_profile(db=db, user_id=user.user_id, body=body)
        data = result.model_dump() if hasattr(result, "model_dump") else result
        return {"success": True, "data": data}
    except SettingsDomainError as exc:
        return _domain_error_to_response(exc)


# ══════════════════════════════════════════════════════════════════════════════
# PATCH /settings/financials
# Update income / savings target; returns new daily budget.
# ══════════════════════════════════════════════════════════════════════════════

@router.patch(
    "/financials",
    response_model=dict,
    summary="Update financial baseline",
    description=(
        "Updates expected_monthly_income and/or monthly_savings_target. "
        "Validates that the savings target does not exceed (income − fixed_costs). "
        "Returns the recalculated projected_safe_daily_budget."
    ),
)
async def patch_financials(
    body: PatchFinancialsRequest,
    user: AuthUser,
    db:   DbClient,
) -> dict[str, Any] | JSONResponse:
    try:
        result = await settings_svc.patch_financials(db=db, user_id=user.user_id, body=body)
        data = result.model_dump() if hasattr(result, "model_dump") else result
        return {"success": True, "data": data}
    except SettingsDomainError as exc:
        return _domain_error_to_response(exc)


# ══════════════════════════════════════════════════════════════════════════════
# PATCH /settings/preferences
# Merge UI / accessibility preference flags.
# ══════════════════════════════════════════════════════════════════════════════

@router.patch(
    "/preferences",
    response_model=dict,
    summary="Update app preferences",
    description=(
        "Merges theme, reduced_motion, and/or privacy_mode into the "
        "app_preferences JSONB column. Theme key must be unlocked in inventory."
    ),
)
async def patch_preferences(
    body: PatchPreferencesRequest,
    user: AuthUser,
    db:   DbClient,
) -> dict[str, Any] | JSONResponse:
    try:
        result = await settings_svc.patch_preferences(db=db, user_id=user.user_id, body=body)
        data = result.model_dump() if hasattr(result, "model_dump") else result
        return {"success": True, "data": data}
    except SettingsDomainError as exc:
        return _domain_error_to_response(exc)


# ══════════════════════════════════════════════════════════════════════════════
# PATCH /settings/notifications
# Merge notification opt-in flags.
# ══════════════════════════════════════════════════════════════════════════════

@router.patch(
    "/notifications",
    response_model=dict,
    summary="Update notification settings",
    description=(
        "Merges daily_reminder, hazard_alerts, and/or achievement_notifications "
        "into the notification_settings JSONB column."
    ),
)
async def patch_notifications(
    body: PatchNotificationsRequest,
    user: AuthUser,
    db:   DbClient,
) -> dict[str, Any] | JSONResponse:
    try:
        result = await settings_svc.patch_notifications(db=db, user_id=user.user_id, body=body)
        data = result.model_dump() if hasattr(result, "model_dump") else result
        return {"success": True, "data": data}
    except SettingsDomainError as exc:
        return _domain_error_to_response(exc)


# ══════════════════════════════════════════════════════════════════════════════
# POST /settings/path/change
# Switch the player's active journey path (avatar class / play style).
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/path/change",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Change journey path",
    description=(
        "Switches the player's active journey path. "
        "Requires the path to differ from the currently active one "
        "(PATH_ALREADY_ACTIVE) and the 180-day cooldown to have expired "
        "(PATH_CHANGE_LOCKED). Publishes a PATH_CHANGED game_event."
    ),
)
async def post_path_change(
    body: PathChangeRequest,
    user: AuthUser,
    db:   DbClient,
    bus:  EventBus = Depends(get_event_bus),
) -> dict[str, Any] | JSONResponse:
    try:
        result = await settings_svc.post_path_change(
            db      = db,
            user_id = user.user_id,
            body    = body,
            bus     = bus,
        )
        data = result.model_dump() if hasattr(result, "model_dump") else result
        return {"success": True, "data": data}
    except SettingsDomainError as exc:
        return _domain_error_to_response(exc)


# ══════════════════════════════════════════════════════════════════════════════
# POST /settings/reset-progress
# Irreversible progression reset — requires {"confirmation": "RESET"}.
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/reset-progress",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Reset game progression",
    description=(
        "Resets HP to 100, XP to 0, and level to 1. "
        "Archives active journey challenges and region progress. "
        "Does NOT touch journey_inventory, standby tokens, or the financial ledger. "
        'Requires {"confirmation": "RESET"} in the request body. '
        "Publishes a PROGRESS_RESET game_event."
    ),
)
async def post_reset_progress(
    body: ResetProgressRequest,
    user: AuthUser,
    db:   DbClient,
    bus:  EventBus = Depends(get_event_bus),
) -> dict[str, Any] | JSONResponse:
    try:
        result = await settings_svc.post_reset_progress(
            db      = db,
            user_id = user.user_id,
            body    = body,
            bus     = bus,
        )
        data = result.model_dump() if hasattr(result, "model_dump") else result
        return {"success": True, "data": data}
    except SettingsDomainError as exc:
        return _domain_error_to_response(exc)

"""
routers/account.py
───────────────────
FastAPI router for account lifecycle management.
Prefix: /api/v1/account

Two endpoints:

  GET    /export  →  Download a full JSON export of the user's data.
  DELETE /        →  Permanently delete the account and all associated data.

Design rules
────────────
  - ``AuthUser``    provides the authenticated user (JWT-verified CurrentUser).
  - ``DbClient``    provides the RLS-scoped authenticated Supabase client.
  - ``GetAdminDB``  provides the service-role singleton needed for
    auth.admin.delete_user — injected separately so normal endpoints
    never accidentally receive elevated credentials.
  - The DELETE route requires the query param ``?confirm=true`` as an
    additional HTTP-layer guard on top of the service-layer logic.
  - Export responses carry ``Content-Disposition: attachment`` so browsers
    trigger a file download rather than rendering JSON inline.

Journey Bleed Status — RESOLVED
────────────────────────────────
  ✓ ``from journey.dependencies``         → ``from app.api.v1.dependencies``
  ✓ ``from journey.models.settings_responses`` → removed; plain-dict responses
  ✓ AccountDomainError, export_account_data, delete_account remain from
    journey.services.account_svc (service layer is unchanged).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse, Response

from app.api.v1.dependencies import AuthUser, DbClient, GetAdminDB
from app.services.account import AccountDomainError, export_account_data, delete_account

_UTC = timezone.utc


# ══════════════════════════════════════════════════════════════════════════════
# Router
# ══════════════════════════════════════════════════════════════════════════════

router = APIRouter(
    prefix="/account",
    tags=["Account"],
)


# ══════════════════════════════════════════════════════════════════════════════
# Error conversion helper
# ══════════════════════════════════════════════════════════════════════════════

def _account_error_to_response(exc: AccountDomainError) -> JSONResponse:
    """
    Convert an AccountDomainError into the standard plain-dict error envelope.

    Returns a raw JSONResponse instead of a Pydantic model to avoid any
    dependency on journey.models response schemas.
    """
    return JSONResponse(
        status_code=exc.http_status,
        content={
            "success": False,
            "error": {
                "code":    "ACCOUNT_ERROR",
                "message": exc.message,
            },
        },
    )


# ══════════════════════════════════════════════════════════════════════════════
# GET /account/export
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/export",
    response_model=None,          # raw Response bypass — schema in ``responses`` dict
    status_code=status.HTTP_200_OK,
    summary="Export account data",
    description=(
        "Generates a synchronous JSON export of all transactions, game events, "
        "and journal entries for the authenticated user. "
        "Returned as a downloadable .json file."
    ),
    responses={
        200: {
            "description": "JSON file containing the user's full data export.",
            "headers": {
                "Content-Disposition": {
                    "description": "Triggers a file download in the browser.",
                    "schema":      {"type": "string"},
                }
            },
        },
        500: {"description": "Unexpected export failure."},
    },
)
async def get_export(
    user: AuthUser,
    db:   DbClient,
) -> Response:
    """
    Build and return the export payload as a JSON file attachment.

    We return a raw ``Response`` (not a Pydantic model) so we can set
    the Content-Disposition header.
    """
    try:
        payload = await export_account_data(db=db, user_id=user.user_id)
    except AccountDomainError as exc:
        return _account_error_to_response(exc)

    date_str  = datetime.now(_UTC).strftime("%Y%m%d")
    uid_short = str(user.user_id).split("-")[0]
    filename  = f"finjourney_export_{uid_short}_{date_str}.json"

    # Normalise — service may return a Pydantic model or a plain dict
    if hasattr(payload, "model_dump_json"):
        content = payload.model_dump_json(indent=2)
    elif hasattr(payload, "model_dump"):
        import json
        content = json.dumps(payload.model_dump(), indent=2)
    else:
        import json
        content = json.dumps(payload, indent=2)

    return Response(
        content      = content,
        media_type   = "application/json",
        headers      = {"Content-Disposition": f'attachment; filename="{filename}"'},
        status_code  = status.HTTP_200_OK,
    )


# ══════════════════════════════════════════════════════════════════════════════
# DELETE /account/
# ══════════════════════════════════════════════════════════════════════════════

@router.delete(
    "",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Delete account",
    description=(
        "Permanently and irreversibly deletes the account and all associated data. "
        "Requires the query parameter ``?confirm=true``. "
        "Triggers a database-wide cascade deletion via the Supabase Admin API."
    ),
    responses={
        200: {"description": "Account deleted successfully."},
        400: {"description": "confirm=true was not supplied."},
        500: {"description": "Admin API or cascade failure."},
        502: {"description": "Supabase Admin API returned an error."},
    },
)
async def delete_account_endpoint(
    user:     AuthUser,
    admin_db: GetAdminDB,
    confirm:  bool = Query(
        default     = False,
        description = (
            "Must be true. Acts as an HTTP-layer guard — ensures the client "
            "made an explicit, intentional DELETE rather than an accidental one."
        ),
    ),
) -> dict[str, Any] | JSONResponse:
    """
    HTTP-layer confirmation check + service call.

    The ``confirm=true`` param is intentional redundancy on top of the JWT:
    it forces the client SDK / UI to pass an explicit flag, making accidental
    deletions from misconfigured HTTP clients or test suites less likely.
    """
    if not confirm:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "error": {
                    "code":    "ACCOUNT_ERROR",
                    "message": "Account deletion requires ?confirm=true query parameter.",
                },
            },
        )

    try:
        result = await delete_account(admin_db=admin_db, user_id=user.user_id)
        data = result.model_dump() if hasattr(result, "model_dump") else result
        return {"success": True, "data": data}
    except AccountDomainError as exc:
        return _account_error_to_response(exc)

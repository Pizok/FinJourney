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
  - ``get_db``       provides the RLS-scoped authenticated client.
  - ``get_admin_db`` provides the service-role client needed for
    auth.admin.delete_user — it is injected separately so normal endpoints
    never accidentally receive elevated credentials.
  - The DELETE route requires the query param ``?confirm=true`` as an
    additional HTTP-layer guard on top of the service-layer logic.
  - Export responses carry ``Content-Disposition: attachment`` so browsers
    trigger a file download rather than rendering JSON inline.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse, Response

from app.api.v1.dependencies import get_admin_db, get_current_user, get_db
from app.schemas.settings_responses import (
    AccountDeleteResponse,
    AccountExportResponse,
    SettingsErrorEnvelope,
    StandardErrorDetail,
)
from app.services.account_service import AccountDomainError, export_account_data, delete_account
from supabase import AsyncClient

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
    Convert an AccountDomainError into the standard settings error envelope.

    We reuse SettingsErrorEnvelope here because the domain shares its error
    contract; the ``code`` field is an internal string not in
    SettingsErrorCodeLiteral so we pass it with a type-ignore.
    """
    body = SettingsErrorEnvelope(
        error=StandardErrorDetail(
            code    = "ACCOUNT_ERROR",  # type: ignore[arg-type]
            message = exc.message,
        )
    )
    return JSONResponse(
        status_code = exc.http_status,
        content     = body.model_dump(mode="json"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# GET /account/export
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "/export",
    response_model = AccountExportResponse,
    status_code    = status.HTTP_200_OK,
    summary        = "Export account data",
    description    = (
        "Generates a synchronous JSON export of all transactions, game events, "
        "and journal entries for the authenticated user. "
        "Returned as a downloadable .json file."
    ),
    responses={
        200: {
            "model":       AccountExportResponse,
            "description": "JSON file containing the user's full data export.",
            "headers": {
                "Content-Disposition": {
                    "description": "Triggers a file download in the browser.",
                    "schema":      {"type": "string"},
                }
            },
        },
        500: {
            "model":       SettingsErrorEnvelope,
            "description": "Unexpected export failure.",
        },
    },
)
async def get_export(
    db:      AsyncClient = Depends(get_db),
    user_id: UUID        = Depends(get_current_user),
) -> Response:
    """
    Build and return the export payload as a JSON file attachment.

    We return a raw ``Response`` (not the Pydantic model) so we can set
    the Content-Disposition header.  FastAPI's ``response_model`` above
    still drives OpenAPI schema generation.
    """
    try:
        payload = await export_account_data(db=db, user_id=user_id)
    except AccountDomainError as exc:
        return _account_error_to_response(exc)

    date_str  = datetime.now(_UTC).strftime("%Y%m%d")
    uid_short = str(user_id).split("-")[0]
    filename  = f"finjourney_export_{uid_short}_{date_str}.json"

    return Response(
        content      = payload.model_dump_json(indent=2),
        media_type   = "application/json",
        headers      = {"Content-Disposition": f'attachment; filename="{filename}"'},
        status_code  = status.HTTP_200_OK,
    )


# ══════════════════════════════════════════════════════════════════════════════
# DELETE /account/
# ══════════════════════════════════════════════════════════════════════════════

@router.delete(
    "/",
    response_model = AccountDeleteResponse,
    status_code    = status.HTTP_200_OK,
    summary        = "Delete account",
    description    = (
        "Permanently and irreversibly deletes the account and all associated data. "
        "Requires the query parameter ``?confirm=true``. "
        "Triggers a database-wide cascade deletion via the Supabase Admin API."
    ),
    responses={
        200: {"model": AccountDeleteResponse},
        400: {
            "model":       SettingsErrorEnvelope,
            "description": "confirm=true was not supplied.",
        },
        500: {
            "model":       SettingsErrorEnvelope,
            "description": "Admin API or cascade failure.",
        },
        502: {
            "model":       SettingsErrorEnvelope,
            "description": "Supabase Admin API returned an error.",
        },
    },
)
async def delete_account_endpoint(
    confirm:  bool         = Query(
        default     = False,
        description = (
            "Must be true. Acts as an HTTP-layer guard — ensures the client "
            "made an explicit, intentional DELETE rather than an accidental one."
        ),
    ),
    admin_db: AsyncClient  = Depends(get_admin_db),
    user_id:  UUID         = Depends(get_current_user),
) -> AccountDeleteResponse | JSONResponse:
    """
    HTTP-layer confirmation check + service call.

    The ``confirm=true`` param is intentional redundancy on top of the JWT:
    it forces the client SDK / UI to pass an explicit flag, making accidental
    deletions from misconfigured HTTP clients or test suites less likely.
    """
    if not confirm:
        body = SettingsErrorEnvelope(
            error=StandardErrorDetail(
                code    = "ACCOUNT_ERROR",   # type: ignore[arg-type]
                message = "Account deletion requires ?confirm=true query parameter.",
            )
        )
        return JSONResponse(
            status_code = status.HTTP_400_BAD_REQUEST,
            content     = body.model_dump(mode="json"),
        )

    try:
        return await delete_account(admin_db=admin_db, user_id=user_id)
    except AccountDomainError as exc:
        return _account_error_to_response(exc)

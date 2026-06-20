# src/backend/journey/dependencies.py
# FastAPI dependency injection providers for the Journey Engine.

from __future__ import annotations

import logging
import os
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from supabase import AsyncClient

from app.api.v1.dependencies import (
    CurrentUser,
    get_current_user as _hub_get_current_user,
    get_db as _hub_get_db,
)
from app.db.supabase import get_admin_db as _hub_get_admin_db

from .engine.bus import EventBus
from .repos.profile_repo import ProfileRepository
from .services.bootstrap_svc import BootstrapService
from .services.cron_svc import CronService
from .services.hp_svc import HPService
from .services.inventory_svc import InventoryService
from .services.xp_svc import XPService

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Environment Config
# ---------------------------------------------------------------------------


def _require_env(key: str) -> str:
    """Reads a mandatory environment variable or raises at startup."""
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(
            f"Required environment variable '{key}' is not set. "
            "Check your .env / deployment secrets."
        )
    return value


# Supabase credentials are managed centrally in app.db.supabase.
# Do NOT read SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY here.

# Upstash QStash signing key for webhook signature verification.
_QSTASH_CURRENT_SIGNING_KEY: str = _require_env("QSTASH_CURRENT_SIGNING_KEY")
_QSTASH_NEXT_SIGNING_KEY: str = os.environ.get("QSTASH_NEXT_SIGNING_KEY", "")


# ---------------------------------------------------------------------------
# Database Client
# ---------------------------------------------------------------------------


async def get_db_client(request: Request) -> AsyncClient:
    """
    Provide an RLS-scoped Supabase AsyncClient for the Journey domain.

    Fully delegates to the centralised hub dependency at
    ``app.api.v1.dependencies.get_db``, which:
      1. Extracts the Bearer JWT from the Authorization header.
      2. Calls ``app.db.supabase.create_rls_client(jwt_token)`` to create a
         fresh client with ``auth.set_session()`` applied — PostgreSQL
         ``auth.uid()`` resolves correctly for every RLS policy.
      3. Falls back to the service-role admin singleton for routes that carry
         no user JWT (cron / QStash webhooks, internal hooks).

    ``acreate_client()`` must never be called directly in this module.
    All client creation is the exclusive responsibility of app.db.supabase.
    """
    return await _hub_get_db(request)


# Annotated alias for convenience in route signatures.
DBClient = Annotated[AsyncClient, Depends(get_db_client)]

# ---------------------------------------------------------------------------
# Public re-exports — backward compatibility for callers that import these
# symbols from journey.dependencies rather than from the hub directly.
# ---------------------------------------------------------------------------

# These are thin re-exports; no business logic is added here.
get_db          = _hub_get_db           # noqa: E305  (used by account.py, settings.py)
get_admin_db    = _hub_get_admin_db     # noqa: E305  (used by account.py)
get_current_user = _hub_get_current_user  # noqa: E305  (used by account.py, settings.py)




# ---------------------------------------------------------------------------
# Authentication — User JWT
# ---------------------------------------------------------------------------


async def get_current_user_id(
    user: Annotated[CurrentUser, Depends(_hub_get_current_user)],
) -> str:
    """
    Extract and verify the Supabase JWT, returning the authenticated user's
    UUID as a plain string.

    Delegates entirely to the canonical ``get_current_user`` dependency from
    ``app.api.v1.dependencies``, which decodes the token locally via
    ``app.core.security.verify_supabase_jwt`` (HS256, audience="authenticated")
    without an additional network round-trip to Supabase Auth.  This replaces
    the previous per-request ``client.auth.get_user()`` call, eliminating the
    rogue ``acreate_client()`` that was created solely for JWT validation.

    Returns the plain ``user_id`` string so that existing Journey route
    handlers typed as ``user_id: CurrentUserID`` continue to work without
    modification.

    Raises:
        HTTP 401: Missing, expired, invalid signature, or wrong audience.
    """
    return user.user_id


# Annotated alias.
CurrentUserID = Annotated[str, Depends(get_current_user_id)]


# ---------------------------------------------------------------------------
# Critical Failure Guard
# ---------------------------------------------------------------------------


async def cf_locked_guard(
    user_id: CurrentUserID,
    db: DBClient,
) -> None:
    """
    Dependency for endpoints marked 🔒 [CF-Locked] in the API spec.
    Raises HTTP 403 if the player's vitality is CRITICAL_FAILURE (HP == 0).

    CF-Locked endpoints:
      POST /claim/zero-spend
      POST /standby/use

    Usage in route:
        @router.post("/claim/zero-spend")
        async def claim_zero_spend(
            _: Annotated[None, Depends(cf_locked_guard)],
            ...
        ):
            ...
    """
    profile_repo = ProfileRepository(db)
    profile = await profile_repo.get_profile(user_id)

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "success": False,
                "error": {
                    "code": "PROFILE_NOT_FOUND",
                    "message": "Player profile does not exist. Complete onboarding first.",
                },
            },
        )

    vitality: str = profile.get("vitality", "NORMAL")
    if vitality == "CRITICAL_FAILURE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "success": False,
                "error": {
                    "code": "CRITICAL_FAILURE_ACTIVE",
                    "message": (
                        "Your HP has reached 0 and your account is locked. "
                        "Complete the Financial Audit via POST /revive to restore access."
                    ),
                },
            },
        )


# Annotated alias for route injection.
CFGuard = Annotated[None, Depends(cf_locked_guard)]


# ---------------------------------------------------------------------------
# QStash Signature Verification
# ---------------------------------------------------------------------------


async def verify_qstash_signature(
    request: Request,
    upstash_signature: Annotated[str | None, Header(alias="upstash-signature")] = None,
) -> None:
    """
    Verifies the Upstash-Signature header on incoming cron webhook requests.
    Must be injected as a dependency on all POST /cron/* endpoints.

    Verification uses HMAC-SHA256 against the raw request body with the
    QSTASH_CURRENT_SIGNING_KEY. If the current key fails, the next key is
    tried to support rolling key rotation without downtime.

    Raises:
        HTTP 401: Missing signature header.
        HTTP 401: Signature verification failed.

    Security:
        Any request to /cron/* that lacks or fails this check is rejected
        before any processing occurs, preventing unauthorized cron triggering.
    """
    if not upstash_signature:
        logger.warning("verify_qstash_signature: missing Upstash-Signature header.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "error": {
                    "code": "MISSING_QSTASH_SIGNATURE",
                    "message": "Upstash-Signature header is required on cron endpoints.",
                },
            },
        )

    body: bytes = await request.body()

    if not _verify_hmac(body, upstash_signature, _QSTASH_CURRENT_SIGNING_KEY):
        # Try the next signing key for zero-downtime key rotation.
        if _QSTASH_NEXT_SIGNING_KEY and _verify_hmac(
            body, upstash_signature, _QSTASH_NEXT_SIGNING_KEY
        ):
            logger.info(
                "verify_qstash_signature: verified with NEXT signing key "
                "(rotation in progress)."
            )
            return

        logger.warning(
            "verify_qstash_signature: HMAC verification failed. "
            "Possible replay attack or misconfigured QStash signing key."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_QSTASH_SIGNATURE",
                    "message": "Upstash-Signature verification failed.",
                },
            },
        )


def _verify_hmac(body: bytes, signature_header: str, signing_key: str) -> bool:
    """
    Verifies an Upstash QStash HMAC-SHA256 signature.

    QStash signature format:
        The header value is a JWT-like string. The actual HMAC is computed
        over the raw request body using the signing key as the HMAC secret.
        We validate by recomputing and comparing using hmac.compare_digest
        (constant-time comparison to prevent timing attacks).

    For production use, replace this with the official Upstash Python SDK:
        from qstash import Receiver
        receiver = Receiver(current_signing_key=..., next_signing_key=...)
        receiver.verify(signature=..., body=..., url=...)
    """
    import base64
    import hashlib
    import hmac as _hmac

    try:
        expected_mac = _hmac.new(
            signing_key.encode("utf-8"),
            body,
            hashlib.sha256,
        ).digest()
        expected_b64 = base64.b64encode(expected_mac).decode("utf-8")

        # QStash sends the signature as a base64-encoded string.
        # Strip any JWT-style prefix if present.
        received = signature_header.strip()
        if "." in received:
            # JWT format: header.payload.signature — take the signature part.
            parts = received.split(".")
            received = parts[-1] if len(parts) == 3 else received

        return _hmac.compare_digest(expected_b64, received)
    except Exception as exc:
        logger.warning("_verify_hmac: comparison error — %s", exc)
        return False


# Annotated alias.
QStashVerified = Annotated[None, Depends(verify_qstash_signature)]


# ---------------------------------------------------------------------------
# Service Providers
# ---------------------------------------------------------------------------


async def get_event_bus(db: DBClient) -> EventBus:
    """
    Provides the EventBus dispatcher for the current request.
    Shares the same db client used by all repos in this request context.
    """
    return EventBus(db)


async def get_xp_service(
    db: DBClient,
    bus: Annotated[EventBus, Depends(get_event_bus)],
) -> XPService:
    """Provides XPService — XP cap enforcement, level-up detection."""
    return XPService(db=db, bus=bus)


async def get_hp_service(
    db: DBClient,
    bus: Annotated[EventBus, Depends(get_event_bus)],
) -> HPService:
    """Provides HPService — shield resolution, damage, heal, financial audit."""
    return HPService(db=db, bus=bus)


async def get_inventory_service(
    db: DBClient,
    bus: Annotated[EventBus, Depends(get_event_bus)],
) -> InventoryService:
    """Provides InventoryService — standby tokens, shield generation, cleanup."""
    return InventoryService(db=db, bus=bus)


async def get_bootstrap_service(db: DBClient) -> BootstrapService:
    """
    Provides BootstrapService — dashboard hydration via asyncio.gather.
    Does not require the EventBus (read-only service).
    """
    return BootstrapService(db=db)


async def get_cron_service(
    db: DBClient,
    bus: Annotated[EventBus, Depends(get_event_bus)],
) -> CronService:
    """Provides CronService — rolling midnight processor and janitor runner."""
    return CronService(db=db, bus=bus)


# ---------------------------------------------------------------------------
# Annotated Shorthand Types (for route signatures)
# ---------------------------------------------------------------------------

BusDep = Annotated[EventBus, Depends(get_event_bus)]
XPServiceDep = Annotated[XPService, Depends(get_xp_service)]
HPServiceDep = Annotated[HPService, Depends(get_hp_service)]
InventoryServiceDep = Annotated[InventoryService, Depends(get_inventory_service)]
BootstrapServiceDep = Annotated[BootstrapService, Depends(get_bootstrap_service)]
CronServiceDep = Annotated[CronService, Depends(get_cron_service)]

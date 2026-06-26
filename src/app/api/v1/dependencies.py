from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import AsyncClient

from app.core.security import verify_supabase_jwt
from app.db.supabase import create_rls_client
from app.db.supabase import get_admin_db as _get_admin_db

# Returns HTTP 403 automatically when Authorization header is missing entirely.
_bearer = HTTPBearer(auto_error=True)


@dataclass(frozen=True, slots=True)
class CurrentUser:
    """Authenticated user context extracted from the JWT."""

    user_id: str
    level: int


async def get_db(request: Request) -> AsyncClient:
    """Return an RLS-scoped client (with JWT) or the admin singleton for cron routes."""
    auth_header: str = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        jwt_token = auth_header.removeprefix("Bearer ").strip()
        return await create_rls_client(jwt_token)
    return _get_admin_db()


def get_admin_db() -> AsyncClient:
    """Return the service-role singleton for RLS-bypass operations."""
    return _get_admin_db()


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> CurrentUser:
    """Verify the Bearer JWT and return a CurrentUser. Raises HTTP 401 on failure."""
    payload = verify_supabase_jwt(credentials.credentials)

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "TOKEN_MALFORMED",
                "message": "JWT is missing the required 'sub' claim.",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    level: int = int(payload.get("app_level", 1))
    return CurrentUser(user_id=user_id, level=level)


# Annotated aliases — use these in endpoint signatures.
AuthUser   = Annotated[CurrentUser, Depends(get_current_user)]
DBClient   = Annotated[AsyncClient, Depends(get_db)]
DbClient   = DBClient          # backward-compat alias
GetAdminDB = Annotated[AsyncClient, Depends(get_admin_db)]

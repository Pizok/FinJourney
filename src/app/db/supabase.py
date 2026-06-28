from __future__ import annotations

from fastapi import HTTPException, status
from supabase import AsyncClient, acreate_client
from supabase_auth.errors import AuthApiError

from app.core.config import settings

# Shared service-role singleton (no per-user session). Call init_supabase()
# once at startup before serving any request.
_admin_client: AsyncClient | None = None


async def init_supabase() -> None:
    """Initialise the shared service-role Supabase client at startup."""
    global _admin_client
    _admin_client = await acreate_client(
        settings.supabase_url,
        settings.supabase_service_key,
    )


def get_admin_db() -> AsyncClient:
    """Return the service-role singleton. Use only for RLS-bypass operations."""
    if _admin_client is None:
        raise RuntimeError(
            "Supabase admin client is not initialised. "
            "Ensure `await init_supabase()` is called during application startup."
        )
    return _admin_client


async def create_rls_client(jwt_token: str) -> AsyncClient:
    """Create a per-request AsyncClient with the user JWT injected for RLS."""
    client: AsyncClient = await acreate_client(
        settings.supabase_url,
        settings.supabase_service_key,
    )
    try:
        await client.auth.set_session(
            access_token=jwt_token,
            refresh_token="",
        )
    except AuthApiError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session invalid or user does not exist",
        )
    return client

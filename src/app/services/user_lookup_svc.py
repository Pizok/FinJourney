"""
app/services/user_lookup_svc.py

Utility for fetching user information from Supabase Auth.

The user email lives in auth.users, not in journey_profiles,
so we call the Supabase Admin API (service role key) to retrieve it.

All functions return None on failure -- callers must guard against None
before attempting to send email.
"""
from __future__ import annotations

import logging

from supabase import AsyncClient

logger = logging.getLogger(__name__)


async def get_user_email(db: AsyncClient, user_id: str) -> str | None:
    """
    Fetches the email address for a given user_id from Supabase Auth.

    Uses the admin client (service role key) to bypass RLS.
    Returns None if the user is not found or on any fetch error.

    Args:
        db:      Supabase AsyncClient (admin or RLS-scoped; admin preferred).
        user_id: UUID string of the target user.

    Returns:
        Email string or None.
    """
    try:
        # auth.admin.get_user_by_id is available on the service-role client.
        response = await db.auth.admin.get_user_by_id(user_id)
        if response and response.user and response.user.email:
            return response.user.email
        logger.debug(
            "user_lookup_svc.get_user_email: no email found for user_id=%s", user_id
        )
        return None
    except Exception as exc:
        logger.warning(
            "user_lookup_svc.get_user_email: failed for user_id=%s -- %s", user_id, exc
        )
        return None


async def get_user_display_name(db: AsyncClient, user_id: str) -> str:
    """
    Fetches the user display name from journey_profiles.
    Falls back to "Traveler" if not found.

    Args:
        db:      Supabase AsyncClient.
        user_id: UUID string of the target user.

    Returns:
        Display name string. Always returns a usable fallback.
    """
    try:
        response = await (
            db.table("journey_profiles")
            .select("display_name")
            .eq("id", user_id)
            .single()
            .execute()
        )
        if response.data:
            return response.data.get("display_name") or "Traveler"
        return "Traveler"
    except Exception as exc:
        logger.debug(
            "user_lookup_svc.get_user_display_name: fallback for user_id=%s -- %s",
            user_id, exc,
        )
        return "Traveler"

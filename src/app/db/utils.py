"""
db/utils.py — Supabase query helpers.

Centralises workarounds for known supabase-py quirks so the rest of the
codebase stays clean.
"""
from __future__ import annotations

from typing import Any

from postgrest import AsyncQueryRequestBuilder


async def maybe_one(query: AsyncQueryRequestBuilder) -> dict[str, Any] | None:
    """
    Execute a `.maybe_single()` query and safely return the data or None.

    Versions of supabase-py that use postgrest-py >= 0.16 return `None`
    directly (not a response object) when no row matches. This helper
    normalises that behaviour so callers never have to guard against it.

    Usage:
        result = await maybe_one(
            db.table("journey_profiles").select("*").eq("id", user_id).maybe_single()
        )
    """
    resp = await query.execute()
    if resp is None:
        return None
    return resp.data  # may still be None if no row found

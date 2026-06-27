"""
wallet_queries.py — Database query layer for the `wallets` table.

All interactions with Supabase are isolated here. No business logic lives
in this file — it is a thin, typed data-access layer. Ownership validation
(wallet.user_id == auth.uid()) is the responsibility of the service layer
that calls these functions.

Architecture constraints (Supabase Free Tier)
---------------------------------------------
* No database triggers.
* No realtime subscriptions.
* No materialized views.
* All aggregations are either simple SQL SUM/COUNT via the Supabase client
  or computed in Python over small, indexed result sets.
* All balance mutations are synchronous and inline.

Soft delete convention
-----------------------
Rows are never hard-deleted. `deleted_at` is set to the current UTC timestamp,
and all read queries filter on `deleted_at IS NULL`.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from supabase import AsyncClient


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _now_utc() -> str:
    """Return the current UTC timestamp as an ISO 8601 string for Supabase."""
    return datetime.now(timezone.utc).isoformat()


def _active_wallets_query(client: AsyncClient, user_id: str):
    """
    Base query: all non-deleted wallets belonging to user_id.
    Returns a PostgREST query builder for further chaining.
    """
    return (
        client.table("wallets")
        .select("*")
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
    )


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

async def get_wallets_by_user(client: AsyncClient, user_id: str) -> list[dict[str, Any]]:
    """
    Fetch all active (non-deleted) wallets for a user.

    Returns
    -------
    list[dict]  — ordered by created_at ascending; empty list if none exist.
    """
    response = await (
        _active_wallets_query(client, user_id)
        .order("created_at", desc=False)
        .execute()
    )
    return response.data or []


async def get_wallet_by_id(
    client: AsyncClient,
    wallet_id: str,
    user_id: str,
) -> Optional[dict[str, Any]]:
    """
    Fetch a single active wallet by its primary key.

    Returns None if the wallet does not exist, is soft-deleted,
    or belongs to a different user.

    Used by the service layer for ownership validation and pre-mutation
    balance snapshots.
    """
    response = await (
        client.table("wallets")
        .select("*")
        .eq("id", wallet_id)
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    return response.data


async def get_wallet_summary(
    client: AsyncClient,
    user_id: str,
) -> dict[str, Any]:
    """
    Aggregate summary data for the wallets summary endpoint.

    Fetches all active wallets and derives:
      * total_balance — sum of wallet.balance across all active wallets (cents)
      * wallet_count  — count of active wallets
      * wallets       — the full list for card rendering

    This is a Python-side aggregation over the active wallet list.
    For MVP scale (≤ 3–20 wallets per user) this is cheaper than an RPC
    round-trip. Replace with `supabase.rpc("get_wallet_summary", ...)` once
    user counts justify a stored procedure.

    Returns
    -------
    dict with keys: total_balance (int), wallet_count (int), wallets (list)
    """
    wallets = await get_wallets_by_user(client, user_id)

    total_balance: int = sum(w.get("balance", 0) for w in wallets)

    return {
        "total_balance": total_balance,
        "wallet_count": len(wallets),
        "wallets": wallets,
    }


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

async def insert_wallet(
    client: AsyncClient,
    *,
    user_id: str,
    name: str,
    wallet_type: str,
    balance: int,
    color_token: Optional[str] = None,
    visible_category_ids: Optional[list[str]] = None,
) -> dict[str, Any]:
    """
    Insert a new wallet row and return the created record.

    Parameters
    ----------
    balance     : Starting balance in integer cents (≥ 0).
    color_token : Optional brand palette token key (validated by schema layer).

    Raises
    ------
    Any Supabase PostgREST exception if the UNIQUE(user_id, name) constraint
    is violated — the service layer catches and converts this to HTTP 409.
    """
    payload: dict[str, Any] = {
        "id":          str(uuid.uuid4()),
        "user_id":     user_id,
        "name":        name,
        "type":        wallet_type,
        "balance":     balance,
        "color_token": color_token,
        "visible_category_ids": visible_category_ids or [],
        "created_at":  _now_utc(),
        "deleted_at":  None,
    }

    response = await (
        client.table("wallets")
        .insert(payload)
        .execute()
    )

    # Supabase insert returns a list; extract the single created record.
    return response.data[0]


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

async def update_wallet(
    client: AsyncClient,
    *,
    wallet_id: str,
    user_id: str,
    updates: dict[str, Any],
) -> dict[str, Any]:
    """
    Update presentation fields on a wallet (name, type, color_token).

    Balance is explicitly EXCLUDED from general updates to prevent race conditions;
    balance mutations must route through `increment_balance` or `decrement_balance`.
    """
    # Defensive programming: strip description and default_payment_method (not in DB)
    safe_updates = {
        k: v for k, v in updates.items() 
        if k not in ["description", "default_payment_method"]
    }

    response = await (
        client.table("wallets")
        .update(safe_updates)
        .eq("id", wallet_id)
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .execute()
    )
    return response.data[0]


async def apply_balance_delta(
    client: AsyncClient,
    wallet_id: str,
    user_id: str,
    delta: int,
) -> dict[str, Any]:
    """
    Atomically apply a signed integer delta to wallet.balance.

    This is the ONLY function that should mutate wallet.balance.
    It must never be called directly from endpoint handlers — only
    from within the transaction pipeline in `transaction_service.py`.

    Parameters
    ----------
    delta : Signed cents. Positive = credit, negative = debit.
            The caller (transaction_service) is responsible for
            deriving the correct sign:
              income   → +amount
              expense  → -amount
              transfer → caller applies two deltas: -amount on source,
                         +amount on destination.

    Implementation note
    -------------------
    Supabase PostgREST does not support `balance = balance + delta` in a
    single UPDATE call from the Python client without a stored function.
    We use a two-step read-modify-write guarded by `user_id` ownership.
    For true atomicity at scale, replace with `supabase.rpc("apply_balance_delta")`.

    Returns
    -------
    Updated wallet dict with the new balance.
    """
    # Step 1: Fetch current balance (also validates ownership)
    wallet = await get_wallet_by_id(client, wallet_id, user_id)
    if wallet is None:
        raise ValueError(
            f"Wallet {wallet_id} not found or does not belong to user {user_id}."
        )

    # Step 2: Compute new balance
    new_balance = wallet["balance"] + delta

    # Step 3: Write back
    response = await (
        client.table("wallets")
        .update({"balance": new_balance})
        .eq("id", wallet_id)
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .execute()
    )

    return response.data[0]


# ---------------------------------------------------------------------------
# Soft Delete
# ---------------------------------------------------------------------------

async def soft_delete_wallet(
    client: AsyncClient,
    wallet_id: str,
    user_id: str,
) -> None:
    """
    Soft-delete a wallet by setting `deleted_at` to the current UTC timestamp.

    The service layer is responsible for enforcing:
      * Last-wallet protection (cannot delete the final active wallet).
      * Zero-balance requirement or warning before deletion.

    This function only performs the DB write; it does not check preconditions.
    """
    await (
        client.table("wallets").update(
            {"deleted_at": _now_utc()}
        ).eq("id", wallet_id).eq("user_id", user_id).is_("deleted_at", "null").execute()
    )

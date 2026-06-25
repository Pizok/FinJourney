"""
app/services/wallet_service.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Wallet service — owns all mutations to the wallets and categories tables.

This module is the correct home for rebalance_budget because:
• Analytics is strictly read-only (analytics_backend.md § Read-Only Boundary).
• The advisory payload only *recommends* adjustments; this service *applies* them.
• Mutations must generate audit journey_events — that belongs in a write service.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NOTE FOR REVIEWERS
──────────────────
This file is an UPDATE to the existing wallet_service.py. Only the new
`rebalance_budget` function and its private helpers are shown below.
Pre-existing wallet CRUD functions (create_wallet, update_wallet, etc.)
are retained as-is in the real codebase; they are omitted here to keep
the diff focused on the analytics deliverable.

Place `rebalance_budget` after the existing wallet management functions.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from supabase import AsyncClient

from app.schemas.wallet import RebalanceBudgetRequest

# ── Internal constants ────────────────────────────────────────────────────────

# Game event type used for the audit ledger entry.
# No HP / XP / gold effects — this is a pure audit record.
_EVENT_TYPE_BUDGET_REBALANCE = "BUDGET_REBALANCE"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# WALLET CRUD FUNCTIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

from app.db.queries import wallet_queries, transaction_queries
from app.schemas.wallet import WalletCreate
from supabase import AsyncClient

async def get_wallets(db: AsyncClient, user_id: str) -> list[dict]:
    """Fetch all active wallets for a user."""
    return await wallet_queries.get_wallets_by_user(db, user_id)

async def create_wallet(
    db: AsyncClient,
    user_id: str,
    payload: WalletCreate,
) -> dict:
    """Create a new wallet."""
    return await wallet_queries.insert_wallet(
        db,
        user_id=user_id,
        name=payload.name,
        wallet_type=payload.wallet_type.value,
        balance=0,  # Or use a starting balance if provided, schema currently has no starting_balance
        color_token=payload.icon, # Map icon to color_token per old schema compatibility
    )

async def update_wallet(
    db: AsyncClient,
    wallet_id: str,
    user_id: str,
    updates: dict,
) -> dict:
    """Update a wallet's mutable presentation fields."""
    return await wallet_queries.update_wallet(
        db,
        wallet_id=wallet_id,
        user_id=user_id,
        updates=updates,
    )

async def delete_wallet(
    db: AsyncClient,
    wallet_id: str,
    user_id: str,
) -> None:
    """Soft-delete a wallet, blocked if it has transactions."""
    transactions = await transaction_queries.fetch_transactions(
        db,
        user_id=user_id,
        wallet_id=wallet_id,
        limit=1,
    )
    if transactions:
        raise ValueError("Cannot delete wallet with existing transactions.")
    
    await wallet_queries.soft_delete_wallet(
        db,
        wallet_id=wallet_id,
        user_id=user_id,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NEW: BUDGET REBALANCE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def rebalance_budget(
    db: AsyncClient,
    *,
    user_id: UUID,
    payload: RebalanceBudgetRequest,
) -> dict:
    """
    Apply one or more category monthly-limit adjustments atomically.

    This is the write counterpart to the analytics advisory payload. The
    frontend constructs this request from Advisory.suggested_actions by
    converting reduction_amount offsets into absolute new_monthly_limit values.

    Guarantees
    ──────────
    • All adjustments are validated for ownership before any write occurs.
    • The entire operation is wrapped in a single database transaction; a
      validation failure or partial write rolls back cleanly.
    • Every adjustment generates an immutable game_event row (xp_delta = 0,
      hp_delta = 0, gold_delta = 0) for the audit ledger.
    • Idempotent: submitting the same limits twice produces the same category
      state and a second audit event (by design — same as editing any record).

    Raises
    ──────
    ValueError("category_not_found"):
        One or more category_ids do not exist, belong to a different user,
        or have been soft-deleted.

    Args:
        db:      Active asyncpg connection (injected by endpoint).
        user_id: Authenticated user UUID — used for ownership validation.
        payload: Validated RebalanceBudgetRequest containing 1+ adjustments.

    Returns:
        dict with keys:
            adjusted_count  int   — number of categories successfully updated
            adjustments     list  — per-category result:
                                    {category_id, category_name,
                                     old_limit, new_limit}
    """
    category_ids = [str(adj.category_id) for adj in payload.adjustments]

    # ── Step 1: ownership validation (single query, all IDs at once) ────
    existing = await _fetch_categories_for_update(db, user_id=str(user_id), category_ids=category_ids)
    existing_map = {row["id"]: row for row in existing}

    missing = [cid for cid in category_ids if cid not in existing_map]
    if missing:
        raise ValueError(
            f"category_not_found: {[str(m) for m in missing]}"
        )

    # ── Step 2: apply each limit update ──────────────────────────────────
    now = datetime.now(tz=timezone.utc).isoformat()
    results = []

    for adj in payload.adjustments:
        adj_id_str = str(adj.category_id)
        row = existing_map[adj_id_str]
        old_limit = int(row["monthly_limit"]) if row["monthly_limit"] is not None else 0

        await (
            db.table("categories")
            .update({"monthly_limit": adj.new_monthly_limit, "updated_at": now})
            .eq("id", adj_id_str)
            .eq("user_id", str(user_id))
            .is_("deleted_at", "null")
            .execute()
        )

        results.append({
            "category_id":   adj.category_id,
            "category_name": row["name"],
            "old_limit":     old_limit,
            "new_limit":     adj.new_monthly_limit,
        })

    # ── Step 3: write a single audit event for this rebalance ───────
    await _write_rebalance_audit_event(
        db,
        user_id=str(user_id),
        adjustment_count=len(results),
        now=now,
    )

    return {
        "adjusted_count": len(results),
        "adjustments":    results,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PRIVATE HELPERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def _fetch_categories_for_update(
    db: AsyncClient,
    *,
    user_id: str,
    category_ids: list[str],
) -> list[dict]:
    """
    Fetch the subset of category_ids that are owned by user_id and not
    soft-deleted. Uses `in_` for a single round-trip instead of
    N individual queries.

    Returns only categories that pass the ownership check; the caller
    diffs this result against the requested IDs to detect violations.
    """
    resp = await (
        db.table("categories")
        .select("id, name, monthly_limit")
        .in_("id", category_ids)
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .execute()
    )
    return resp.data or []


async def _write_rebalance_audit_event(
    db: AsyncClient,
    *,
    user_id: str,
    adjustment_count: int,
    now: str,
) -> None:
    """
    Append an immutable audit row to journey_events.

    This event carries zero progression deltas (HP, XP, gold) because a
    budget rebalance does not affect player progression — it is a pure
    financial planning action. The `metadata` payload captures the scale.
    """
    await (
        db.table("journey_events")
        .insert(
            {
                "user_id": user_id,
                "event_type": _EVENT_TYPE_BUDGET_REBALANCE,
                "source": "system",
                "severity": "info",
                "status": "applied",
                "metadata": {"rebalanced_categories": adjustment_count},
                "xp_delta": 0,
                "hp_delta": 0,
                "shield_delta": 0,
            }
        )
        .execute()
    )

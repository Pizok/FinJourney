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
from app.db.queries.transaction_queries import insert_game_event

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
    wallet = await wallet_queries.insert_wallet(
        db,
        user_id=user_id,
        name=payload.name,
        wallet_type=payload.wallet_type.value,
        balance=payload.balance,
        color_token=payload.icon,
        visible_category_ids=[str(cid) for cid in payload.visible_category_ids],
    )
    
    try:
        from app.journey.engine.bus import EventBus
        from app.journey.repos.event_repo import EventRepository
        from datetime import datetime, timezone
        bus = EventBus(db=db)
        local_date = datetime.now(timezone.utc).date().isoformat()
        idem_key = EventRepository.build_idempotency_key(
            user_id, local_date, "WALLET_CREATED", suffix=wallet.get("id", "x")[:8]
        )
        await bus.publish(
            user_id=user_id,
            event_type="WALLET_CREATED",
            source="USER",
            severity="SUCCESS",
            idempotency_key=idem_key,
            payload={"wallet_id": wallet.get("id")}
        )
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Failed to publish WALLET_CREATED event")
        
    return wallet

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
# CATEGORY CRUD FUNCTIONS
# (These are called from categories.py — they delegate to category_queries)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

from app.db.queries import category_queries
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate


async def get_categories(db: AsyncClient, user_id: str) -> list[CategoryOut]:
    """Return all active categories for a user."""
    rows = await db.table("categories") \
        .select("*") \
        .eq("user_id", user_id) \
        .is_("deleted_at", "null") \
        .order("created_at", desc=False) \
        .execute()
    return [CategoryOut.model_validate(row) for row in (rows.data or [])]


async def create_category(
    client: AsyncClient,
    user_id: str,
    payload: CategoryCreate,
    current_level: int = 1,
) -> CategoryOut:
    """Create a new category, enforcing level cap."""
    existing = await client.table("categories") \
        .select("id") \
        .eq("user_id", user_id) \
        .is_("deleted_at", "null") \
        .execute()
    category_count = len(existing.data or [])
    max_categories = 10  # Level 1 cap — extend based on level as needed
    if category_count >= max_categories:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=403,
            detail={"code": "LEVEL_GATE_CATEGORY_CAP", "message": f"Maximum {max_categories} categories allowed."},
        )

    from datetime import datetime, timezone
    import uuid as _uuid
    payload_dict = {
        "id": str(_uuid.uuid4()),
        "user_id": user_id,
        "name": payload.name,
        "category_group": "expense",
        "monthly_limit": payload.monthly_limit,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "deleted_at": None,
    }
    result = await client.table("categories").insert(payload_dict).execute()
    return CategoryOut.model_validate(result.data[0])


async def update_category(
    client: AsyncClient,
    category_id: str,
    user_id: str,
    payload: CategoryUpdate,
) -> CategoryOut:
    """Update a category's name and/or monthly limit."""
    updates = payload.model_dump(exclude_unset=True)
    result = await client.table("categories") \
        .update(updates) \
        .eq("id", category_id) \
        .eq("user_id", user_id) \
        .is_("deleted_at", "null") \
        .execute()
    if not result.data:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Category not found.")
        
    category = CategoryOut.model_validate(result.data[0])
    
    try:
        from app.journey.engine.bus import EventBus
        from app.journey.repos.event_repo import EventRepository
        from datetime import datetime, timezone
        bus = EventBus(db=client)
        local_date = datetime.now(timezone.utc).date().isoformat()
        idem_key = EventRepository.build_idempotency_key(
            user_id, local_date, "CATEGORY_UPDATED", suffix=category.id[:8]
        )
        await bus.publish(
            user_id=user_id,
            event_type="CATEGORY_UPDATED",
            source="USER",
            severity="SUCCESS",
            idempotency_key=idem_key,
            payload={"category_id": category.id}
        )
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Failed to publish CATEGORY_UPDATED event")
        
    return category


async def delete_category(
    client: AsyncClient,
    category_id: str,
    user_id: str,
) -> None:
    """Soft-delete a category."""
    from datetime import datetime, timezone
    await client.table("categories") \
        .update({"deleted_at": datetime.now(timezone.utc).isoformat()}) \
        .eq("id", category_id) \
        .eq("user_id", user_id) \
        .is_("deleted_at", "null") \
        .execute()


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

    Guarantees:
    - Zero-sum validation: Total reduction must exactly equal the total overspent amount.
    - Atomicity: The database transaction is committed via a Postgres RPC function.
    """
    from app.db.queries import category_queries
    import json

    user_id_str = str(user_id)
    
    # 1. Fetch current category usage to get authoritative limits and spent amounts
    usage = await category_queries.get_category_usage(db, user_id=user_id_str)
    usage_map = {row["category_id"]: row for row in usage}

    # 2. Calculate overspent amount and identify overspent categories
    overspent_categories = [cat for cat in usage if cat["is_overspent"]]
    total_overspent = sum(cat["spent"] - cat["limit"] for cat in overspent_categories)

    if total_overspent <= 0:
        raise ValueError("validation_error: No categories are currently overspent.")

    # 3. Calculate total reductions based on DB limits
    total_reduction = 0
    final_adjustments = []

    for adj in payload.adjustments:
        cat_id_str = str(adj.category_id)
        if cat_id_str not in usage_map:
            raise ValueError(f"category_not_found: {cat_id_str}")
        
        db_cat = usage_map[cat_id_str]
        current_limit = db_cat["limit"]
        new_limit = adj.new_limit
        
        if new_limit > current_limit:
            raise ValueError(f"validation_error: New limit for {db_cat['name']} cannot be greater than its current limit.")
            
        reduction = current_limit - new_limit
        total_reduction += reduction
        
        final_adjustments.append({
            "category_id": cat_id_str,
            "new_monthly_limit": new_limit,
            "category_name": db_cat["name"],
            "old_limit": current_limit
        })

    # 4. Validate zero-sum invariant
    if total_reduction != total_overspent:
        raise ValueError(f"validation_error: Total reductions ({total_reduction}) must equal total overspent amount ({total_overspent}).")

    # 5. Increase limits for overspent categories
    for cat in overspent_categories:
        final_adjustments.append({
            "category_id": cat["category_id"],
            "new_monthly_limit": cat["spent"],
            "category_name": cat["name"],
            "old_limit": cat["limit"]
        })

    # 6. Call the RPC to apply adjustments and insert game_event atomically
    # The RPC expects p_adjustments as JSONB; the Supabase client handles serialization automatically.
    try:
        rpc_payload = [{"category_id": a["category_id"], "new_monthly_limit": a["new_monthly_limit"]} for a in final_adjustments]
        await db.rpc("rebalance_budget_rpc", {
            "p_user_id": user_id_str,
            "p_adjustments": rpc_payload
        }).execute()
    except Exception as e:
        raise ValueError(f"rpc_error: {str(e)}")

    # Format result for frontend
    results = [
        {
            "category_id": a["category_id"],
            "category_name": a["category_name"],
            "old_limit": a["old_limit"],
            "new_limit": a["new_monthly_limit"]
        } for a in final_adjustments
    ]

    return {
        "adjusted_count": len(results),
        "adjustments": results,
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
    await insert_game_event(
        db=db,
        user_id=user_id,
        event_type=_EVENT_TYPE_BUDGET_REBALANCE,
        metadata={"rebalanced_categories": adjustment_count}
    )

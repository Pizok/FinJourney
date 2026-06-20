from datetime import datetime, timezone
from supabase import AsyncClient


async def insert_transaction(
    db: AsyncClient,
    user_id: str,
    wallet_id: str,
    category_id: str,
    tx_type: str,
    amount: float,
    note: str | None,
    logged_at: str,
) -> dict:
    result = await (
        db.table("transactions")
        .insert(
            {
                "user_id": user_id,
                "wallet_id": wallet_id,
                "category_id": category_id,
                "type": tx_type,
                "amount": amount,
                "note": note,
                "logged_at": logged_at,
            }
        )
        .execute()
    )
    return result.data[0]


async def insert_game_event(
    db: AsyncClient,
    user_id: str,
    event_type: str,
    xp_delta: float = 0.0,
    hp_delta: float = 0.0,
    gold_delta: float = 0.0,
    shield_delta: float = 0.0,
    source_id: str | None = None,
    metadata: dict | None = None,
) -> dict:
    """Append to the immutable event ledger. Never call UPDATE or DELETE on game_events."""
    result = await (
        db.table("game_events")
        .insert(
            {
                "user_id": user_id,
                "event_type": event_type,
                "xp_delta": xp_delta,
                "hp_delta": hp_delta,
                "gold_delta": gold_delta,
                "shield_delta": shield_delta,
                "source_id": source_id,
                "metadata": metadata or {},
            }
        )
        .execute()
    )
    return result.data[0]


async def update_player_state(
    db: AsyncClient,
    user_id: str,
    hp: float | None = None,
    xp: float | None = None,
    gold: float | None = None,
    shield: float | None = None,
    standby_tokens: int | None = None,
    extra: dict | None = None,
) -> dict:
    """Apply partial updates to player_state. HP is clamped 0–100; XP is floor-clamped to 0."""
    updates: dict = {}
    if hp is not None:
        updates["hp"] = max(0.0, min(100.0, hp))
    if xp is not None:
        updates["xp"] = max(0.0, xp)
    if gold is not None:
        updates["gold"] = gold
    if shield is not None:
        updates["shield"] = max(0.0, shield)
    if standby_tokens is not None:
        updates["standby_tokens"] = max(0, standby_tokens)
    if extra:
        updates.update(extra)

    if not updates:
        return {}

    result = await (
        db.table("player_state")
        .update(updates)
        .eq("user_id", user_id)
        .execute()
    )
    return result.data[0] if result.data else {}


async def fetch_transaction_by_id(
    db: AsyncClient, tx_id: str, user_id: str
) -> dict | None:
    result = await (
        db.table("transactions")
        .select("*")
        .eq("id", tx_id)
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .maybe_single()
        .execute()
    )
    return result.data


async def soft_delete_transaction(
    db: AsyncClient, tx_id: str, user_id: str
) -> None:
    await (
        db.table("transactions")
        .update({"deleted_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", tx_id)
        .eq("user_id", user_id)
        .execute()
    )


async def fetch_transactions(
    db: AsyncClient,
    user_id: str,
    limit: int = 20,
    offset: int = 0,
    wallet_id: str | None = None,
    category_id: str | None = None,
    tx_type: str | None = None,
) -> list[dict]:
    query = (
        db.table("transactions")
        .select("id, wallet_id, category_id, type, amount, note, logged_at")
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .order("logged_at", desc=True)
        .limit(limit)
        .offset(offset)
    )
    if wallet_id:
        query = query.eq("wallet_id", wallet_id)
    if category_id:
        query = query.eq("category_id", category_id)
    if tx_type:
        query = query.eq("type", tx_type)

    result = await query.execute()
    return result.data or []

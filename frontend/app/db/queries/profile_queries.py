from supabase import AsyncClient

from app.db.utils import maybe_one


async def fetch_profile(db: AsyncClient, user_id: str) -> dict | None:
    return await maybe_one(
        db.table("journey_profiles")
        .select("*")
        .eq("id", user_id)
        .maybe_single()
    )


async def fetch_player_state(db: AsyncClient, user_id: str) -> dict | None:
    result = await maybe_one(
        db.table("journey_profiles")
        .select("current_hp, total_xp, gold_coins, defense_shield, standby_tokens")
        .eq("id", user_id)
        .maybe_single()
    )
    if not result:
        return None
    return {
        "hp": result.get("current_hp", 0),
        "xp": result.get("total_xp", 0),
        "gold": result.get("gold_coins", 0),
        "shield": result.get("defense_shield", 0),
        "standby_tokens": result.get("standby_tokens", 0),
    }


async def fetch_wallets(db: AsyncClient, user_id: str) -> list[dict]:
    result = await (
        db.table("wallets")
        .select("*")
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .order("created_at")
        .execute()
    )
    return result.data or []


async def fetch_categories(db: AsyncClient, user_id: str) -> list[dict]:
    result = await (
        db.table("categories")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
    )
    return result.data or []

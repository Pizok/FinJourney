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
    import asyncio

    profile_task = db.table("journey_profiles") \
        .select("current_hp, total_xp, gold_coins, defense_shield") \
        .eq("id", user_id) \
        .maybe_single() \
        .execute()

    inv_task = db.table("journey_inventory") \
        .select("id", count="exact") \
        .eq("user_id", user_id) \
        .eq("type", "STANDBY_TOKEN") \
        .eq("status", "AVAILABLE") \
        .execute()

    profile_res, inv_res = await asyncio.gather(profile_task, inv_task)
    
    if not profile_res.data:
        return None

    result = profile_res.data
    standby_tokens = inv_res.count if hasattr(inv_res, "count") and inv_res.count is not None else 0

    return {
        "hp": result.get("current_hp", 0),
        "xp": result.get("total_xp", 0),
        "gold": result.get("gold_coins", 0),
        "shield": result.get("defense_shield", 0),
        "standby_tokens": standby_tokens,
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

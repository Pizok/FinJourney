from supabase import AsyncClient


async def fetch_profile(db: AsyncClient, user_id: str) -> dict | None:
    result = await (
        db.table("journey_profiles")
        .select("*")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    return result.data


async def fetch_player_state(db: AsyncClient, user_id: str) -> dict | None:
    result = await (
        db.table("journey_profiles")
        .select("current_hp, total_xp, gold_coins, defense_shield, standby_tokens")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        return None
    return {
        "hp": result.data.get("current_hp", 0),
        "xp": result.data.get("total_xp", 0),
        "gold": result.data.get("gold_coins", 0),
        "shield": result.data.get("defense_shield", 0),
        "standby_tokens": result.data.get("standby_tokens", 0),
    }


async def fetch_wallets(db: AsyncClient, user_id: str) -> list[dict]:
    result = await (
        db.table("wallets")
        .select("id, name, icon, balance, created_at")
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .order("created_at")
        .execute()
    )
    return result.data or []


async def fetch_categories(db: AsyncClient, user_id: str) -> list[dict]:
    result = await (
        db.table("categories")
        .select("id, name, icon, category_group, created_at")
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
    )
    return result.data or []

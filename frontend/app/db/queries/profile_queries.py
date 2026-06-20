from supabase import AsyncClient


async def fetch_profile(db: AsyncClient, user_id: str) -> dict | None:
    result = await (
        db.table("profiles")
        .select("id, username, avatar_class, timezone, active_theme, onboarding_complete, current_region_id, created_at")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    return result.data


async def fetch_player_state(db: AsyncClient, user_id: str) -> dict | None:
    result = await (
        db.table("player_state")
        .select("hp, xp, gold, shield, standby_tokens, tax_state, updated_at")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    return result.data


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

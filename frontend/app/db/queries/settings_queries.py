from typing import Any, Optional
from datetime import datetime, timezone
from supabase import AsyncClient

def _now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()

async def fetch_settings_profile(db: AsyncClient, user_id: str) -> dict | None:
    """
    Fetches the full profile including financials, preferences, and notifications.
    This query is optimized for the SettingsHydration endpoint.
    """
    result = await (
        db.table("journey_profiles")
        .select(
            "id, username, avatar_key, timezone, "
            "expected_monthly_income, monthly_savings_target, "
            "app_preferences, notification_settings, "
            "active_path, path_cooldown_until, last_timezone_change_at, "
            "current_hp, total_xp, current_level, vitality, current_streak, longest_streak"
        )
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    return result.data

async def update_profile(db: AsyncClient, user_id: str, updates: dict[str, Any]) -> dict | None:
    """
    Patches username and timezone.
    """
    if not updates:
        return None
    
    # We allow patching username and timezone.
    # The cooldown logic (setting last_username_change_at etc.) is handled by the service before calling this.
    result = await (
        db.table("journey_profiles")
        .update(updates)
        .eq("id", user_id)
        .execute()
    )
    return result.data[0] if result.data else None

async def update_financials(db: AsyncClient, user_id: str, updates: dict[str, Any]) -> dict | None:
    if not updates:
        return None
    result = await (
        db.table("journey_profiles")
        .update(updates)
        .eq("id", user_id)
        .execute()
    )
    return result.data[0] if result.data else None

async def update_preferences(db: AsyncClient, user_id: str, app_preferences: dict[str, Any]) -> dict | None:
    result = await (
        db.table("journey_profiles")
        .update({"app_preferences": app_preferences})
        .eq("id", user_id)
        .execute()
    )
    return result.data[0] if result.data else None

async def update_notifications(db: AsyncClient, user_id: str, notification_settings: dict[str, Any]) -> dict | None:
    result = await (
        db.table("journey_profiles")
        .update({"notification_settings": notification_settings})
        .eq("id", user_id)
        .execute()
    )
    return result.data[0] if result.data else None

async def fetch_fixed_costs(db: AsyncClient, user_id: str) -> dict[str, Any]:
    """
    Aggregates active fixed categories and outstanding loans.
    """
    # 1. Fetch fixed categories
    categories_result = await (
        db.table("fixed_expenses")
        .select("id, name, amount")
        .eq("user_id", user_id)
        .execute()
    )
    fixed_categories = categories_result.data or []

    # 2. Fetch active loans (status = 'ACTIVE')
    loans_result = await (
        db.table("loans")
        .select("id, name, monthly_installment")
        .eq("user_id", user_id)
        .eq("status", "ACTIVE")
        .execute()
    )
    active_loans = loans_result.data or []

    total_costs = 0.0
    for cat in fixed_categories:
        total_costs += float(cat.get("amount", 0))

    for loan in active_loans:
        total_costs += float(loan.get("monthly_installment", 0)) / 100.0 # installment is in cents
        
    return {
        "categories": fixed_categories,
        "loans": active_loans,
        "total_fixed_costs": total_costs
    }

async def update_path(db: AsyncClient, user_id: str, active_path: str, cooldown_until: str) -> dict | None:
    result = await (
        db.table("journey_profiles")
        .update({
            "active_path": active_path,
            "path_cooldown_until": cooldown_until
        })
        .eq("id", user_id)
        .execute()
    )
    return result.data[0] if result.data else None

async def reset_user_progress_txn(db: AsyncClient, user_id: str) -> None:
    """
    Executes database updates to reset user progression and soft-cancel challenges/regions.
    """
    # We execute these sequentially but they run on the server.
    # 1. Reset Profile Stats
    await db.table("journey_profiles").update({
        "current_hp": 100, # Assuming max HP is 100
        "total_xp": 0,
        "gold_coins": 0,
        "defense_shield": 0,
        "active_path": "balanced",
        "path_cooldown_until": None,
        "streak_count": 0,
        "highest_streak": 0,
        "standby_tokens": 0
    }).eq("id", user_id).execute()

    # 2. Archive Active/Preparing Challenges
    # Note: If no rows match, Supabase update returns empty list, no error is thrown.
    await db.table("journey_challenges").update({
        "status": "ARCHIVED"
    }).eq("user_id", user_id).neq("status", "ARCHIVED").neq("status", "COMPLETED").neq("status", "FAILED").execute()

    # 3. Archive Active/Preparing Regions
    await db.table("journey_regions").update({
        "status": "ARCHIVED"
    }).eq("user_id", user_id).neq("status", "ARCHIVED").neq("status", "COMPLETED").execute()

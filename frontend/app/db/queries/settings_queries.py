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
            "id, username, avatar_class, timezone, active_theme, "
            "expected_monthly_income, monthly_savings_target, primary_payday, "
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
    Patches username, timezone, and primary_payday.
    """
    if not updates:
        return None
    
    # We allow patching username, timezone, and primary_payday.
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
        db.table("categories")
        .select("id, name, monthly_limit")
        .eq("user_id", user_id)
        .eq("category_group", "fixed")
        .is_("deleted_at", "null")
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
        total_costs += float(cat.get("monthly_limit", 0)) / 100.0  # limit is in cents

    for loan in active_loans:
        total_costs += float(loan.get("monthly_installment", 0)) / 100.0 # installment is in cents
        
    return {
        "categories": fixed_categories,
        "loans": active_loans,
        "total_fixed_costs": total_costs
    }

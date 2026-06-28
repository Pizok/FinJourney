import asyncio

from supabase import AsyncClient

from app.db.queries.daily_queries import (
    fetch_active_region,
    fetch_baselines,
    fetch_daily_status,
    fetch_streak,
    fetch_tasks,
    fetch_active_challenge,
)
from app.db.queries.profile_queries import (
    fetch_categories,
    fetch_player_state,
    fetch_profile,
    fetch_wallets,
)
from app.services.budget_service import calculate_daily_budget
from app.services.progression_service import calculate_level, get_feature_unlocks
from app.db.queries.transaction_queries import fetch_transactions


async def build_bootstrap_payload(db: AsyncClient, user_id: str) -> dict:
    """
    Two-phase parallel data aggregation for the dashboard hydration endpoint.

    Phase 1 — profile + player_state (both needed for downstream derivation).
    Phase 2 — all remaining data, including daily budget computed from baselines.
    """
    # ── Phase 1 ───────────────────────────────────────────────────────────────
    profile, player_state = await asyncio.gather(
        fetch_profile(db, user_id),
        fetch_player_state(db, user_id),
    )

    if not profile:
        raise LookupError(f"Profile not found for user {user_id}")
    if not player_state:
        raise LookupError(f"Player state not found for user {user_id}")

    user_tz: str = profile.get("timezone", "UTC")
    level = calculate_level(player_state.get("xp", 0.0))

    # ── Phase 2 — fire everything concurrently ────────────────────────────────
    (
        wallets,
        categories,
        tasks,
        baselines,
        active_region,
        daily_raw,
        streak,
        recent_transactions,
        active_challenge,
    ) = await asyncio.gather(
        fetch_wallets(db, user_id),
        fetch_categories(db, user_id),
        fetch_tasks(db, user_id),
        fetch_baselines(db, user_id),
        fetch_active_region(db, user_id),
        fetch_daily_status(db, user_id, user_tz),
        fetch_streak(db, user_id),
        fetch_transactions(db, user_id, limit=10),
        fetch_active_challenge(db, user_id),
    )

    # ── Derived daily status ──────────────────────────────────────────────────
    daily_budget = 0.0
    if baselines:
        daily_budget = calculate_daily_budget(
            baselines["monthly_income"],
            baselines["fixed_costs"],
            baselines["savings_target"],
        )

    spent_today: float = daily_raw.get("spent_today", 0.0)
    budget_percent_used: float = (
        round((spent_today / daily_budget) * 100, 1) if daily_budget > 0 else 0.0
    )
    last_transaction_at = daily_raw.get("last_transaction_at")

    return {
        "profile": {
            **profile,
            "level": level,
        },
        "player_state": player_state,
        "daily_status": {
            "daily_budget": round(daily_budget, 2),
            "spent_today": round(spent_today, 2),
            "remaining_budget": round(daily_budget - spent_today, 2),
            "budget_percent_used": budget_percent_used,
            "streak_count": streak,
            "zero_spend_marked": daily_raw.get("zero_spend_marked", False),
            "expense_logged_today": daily_raw.get("expense_logged_today", False),
            "income_logged_today": daily_raw.get("income_logged_today", False),
            "standby_active": False,
            "last_transaction_at": last_transaction_at,
            "ghost_warning": False,
            "ghost_penalty_active": False,
            "baseline_set": bool(baselines),
            "tasks_completed": 0,
            "tasks_total": len(tasks),
        },
        "wallets": wallets,
        "categories": categories,
        "tasks": tasks,
        "active_region": active_region,
        "active_challenge": active_challenge,
        "recent_transactions": recent_transactions,
        "feature_unlocks": get_feature_unlocks(level, profile.get("is_dev_account", False)),
    }

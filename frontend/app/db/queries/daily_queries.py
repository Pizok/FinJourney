from datetime import datetime
import pytz
from supabase import AsyncClient


def _today_utc_bounds(tz_name: str) -> tuple[str, str]:
    """Return UTC ISO strings for start and end of today in the user's timezone."""
    tz = pytz.timezone(tz_name)
    now_local = datetime.now(tz)
    start = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    end = now_local.replace(hour=23, minute=59, second=59, microsecond=999999)
    return (
        start.astimezone(pytz.utc).isoformat(),
        end.astimezone(pytz.utc).isoformat(),
    )


async def fetch_daily_status(db: AsyncClient, user_id: str, tz_name: str) -> dict:
    """Sum today's expenses in the user's local timezone."""
    start_utc, end_utc = _today_utc_bounds(tz_name)

    expenses = await (
        db.table("transactions")
        .select("amount")
        .eq("user_id", user_id)
        .eq("type", "expense")
        .is_("deleted_at", "null")
        .gte("logged_at", start_utc)
        .lte("logged_at", end_utc)
        .execute()
    )
    spent_today = sum(r["amount"] for r in (expenses.data or []))

    tz = pytz.timezone(tz_name)
    today_str = datetime.now(tz).date().isoformat()

    snapshot = await (
        db.table("daily_snapshots")
        .select("zero_spend_marked")
        .eq("user_id", user_id)
        .eq("snapshot_date", today_str)
        .maybe_single()
        .execute()
    )
    zero_spend_marked = bool(snapshot.data and snapshot.data.get("zero_spend_marked"))

    return {
        "spent_today": spent_today,
        "zero_spend_marked": zero_spend_marked,
        "date_local": today_str,
    }


async def fetch_streak(db: AsyncClient, user_id: str) -> int:
    result = await (
        db.table("daily_snapshots")
        .select("streak_count")
        .eq("user_id", user_id)
        .order("snapshot_date", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0].get("streak_count", 0)
    return 0


async def fetch_baselines(db: AsyncClient, user_id: str) -> dict | None:
    """Return the most recent financial baseline for the user."""
    result = await (
        db.table("baselines")
        .select("monthly_income, fixed_costs, savings_target, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


async def fetch_tasks(db: AsyncClient, user_id: str) -> list[dict]:
    result = await (
        db.table("tasks")
        .select(
            "id, title, objective_type, target_value, reward_xp, reward_gold, "
            "repeat_type, completed_today, narrative_text"
        )
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
    )
    return result.data or []


async def fetch_active_region(db: AsyncClient, user_id: str) -> dict | None:
    result = await (
        db.table("region_progress")
        .select("*, region_catalog(name, description, visual_theme, asset_bundle_key)")
        .eq("user_id", user_id)
        .eq("status", "active")
        .maybe_single()
        .execute()
    )
    return result.data


async def upsert_daily_snapshot(
    db: AsyncClient,
    user_id: str,
    snapshot_date: str,
    updates: dict,
) -> None:
    existing = await (
        db.table("daily_snapshots")
        .select("id")
        .eq("user_id", user_id)
        .eq("snapshot_date", snapshot_date)
        .maybe_single()
        .execute()
    )
    if existing.data:
        await (
            db.table("daily_snapshots")
            .update(updates)
            .eq("id", existing.data["id"])
            .execute()
        )
    else:
        await (
            db.table("daily_snapshots")
            .insert({"user_id": user_id, "snapshot_date": snapshot_date, **updates})
            .execute()
        )

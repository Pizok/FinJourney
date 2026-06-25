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
        db.table("journey_daily_survival")
        .select("zero_spend_xp_claimed")
        .eq("user_id", user_id)
        .eq("tracking_date", today_str)
        .maybe_single()
        .execute()
    )
    zero_spend_marked = bool(snapshot.data and snapshot.data.get("zero_spend_xp_claimed"))

    return {
        "spent_today": spent_today,
        "zero_spend_marked": zero_spend_marked,
        "date_local": today_str,
    }


async def fetch_streak(db: AsyncClient, user_id: str) -> int:
    result = await (
        db.table("journey_profiles")
        .select("current_streak")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if result.data:
        return result.data.get("current_streak", 0)
    return 0


async def fetch_baselines(db: AsyncClient, user_id: str) -> dict | None:
    """Return the most recent financial baseline for the user."""
    profile_res = await (
        db.table("journey_profiles")
        .select("expected_monthly_income, monthly_savings_target")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not profile_res.data:
        return None

    expenses_res = await (
        db.table("fixed_expenses")
        .select("amount")
        .eq("user_id", user_id)
        .execute()
    )
    fixed_costs = sum(item["amount"] for item in (expenses_res.data or []))

    return {
        "monthly_income": profile_res.data.get("expected_monthly_income", 0),
        "fixed_costs": fixed_costs,
        "savings_target": profile_res.data.get("monthly_savings_target", 0),
        "created_at": datetime.utcnow().isoformat()
    }


async def fetch_tasks(db: AsyncClient, user_id: str) -> list[dict]:
    result = await (
        db.table("journey_challenges")
        .select("*")
        .eq("user_id", user_id)
        .order("started_at")
        .execute()
    )
    return result.data or []


async def fetch_active_region(db: AsyncClient, user_id: str) -> dict | None:
    result = await (
        db.table("journey_regions")
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
    if "zero_spend_marked" in updates:
        updates["zero_spend_xp_claimed"] = updates.pop("zero_spend_marked")
        
    existing = await (
        db.table("journey_daily_survival")
        .select("user_id")
        .eq("user_id", user_id)
        .eq("tracking_date", snapshot_date)
        .maybe_single()
        .execute()
    )
    if existing.data:
        await (
            db.table("journey_daily_survival")
            .update(updates)
            .eq("user_id", user_id)
            .eq("tracking_date", snapshot_date)
            .execute()
        )
    else:
        await (
            db.table("journey_daily_survival")
            .insert({"user_id": user_id, "tracking_date": snapshot_date, **updates})
            .execute()
        )

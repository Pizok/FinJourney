from datetime import datetime
import pytz
from supabase import AsyncClient

from app.db.utils import maybe_one


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

    transactions = await (
        db.table("transactions")
        .select("amount, type")
        .eq("user_id", user_id)
        .in_("type", ["expense", "income"])
        .is_("deleted_at", "null")
        .gte("logged_at", start_utc)
        .lte("logged_at", end_utc)
        .execute()
    )
    
    tx_data = transactions.data or []
    expenses = [r for r in tx_data if r["type"] == "expense"]
    incomes = [r for r in tx_data if r["type"] == "income"]
    
    spent_today = sum(r["amount"] for r in expenses)
    expense_logged_today = len(expenses) > 0
    income_logged_today = len(incomes) > 0

    tz = pytz.timezone(tz_name)
    today_str = datetime.now(tz).date().isoformat()

    snapshot = await maybe_one(
        db.table("journey_daily_survival")
        .select("zero_spend_xp_claimed")
        .eq("user_id", user_id)
        .eq("tracking_date", today_str)
        .limit(1).maybe_single()
    )
    zero_spend_marked = bool(snapshot and snapshot.get("zero_spend_xp_claimed"))

    return {
        "spent_today": spent_today,
        "expense_logged_today": expense_logged_today,
        "income_logged_today": income_logged_today,
        "zero_spend_marked": zero_spend_marked,
        "date_local": today_str,
    }


async def fetch_streak(db: AsyncClient, user_id: str) -> int:
    result = await maybe_one(
        db.table("journey_profiles")
        .select("current_streak")
        .eq("id", user_id)
        .limit(1).maybe_single()
    )
    return result.get("current_streak", 0) if result else 0


async def fetch_baselines(db: AsyncClient, user_id: str) -> dict | None:
    """Return the most recent financial baseline for the user."""
    profile = await maybe_one(
        db.table("journey_profiles")
        .select("expected_monthly_income, monthly_savings_target")
        .eq("id", user_id)
        .limit(1).maybe_single()
    )
    if not profile:
        return None

    expenses_res = await (
        db.table("fixed_expenses")
        .select("amount")
        .eq("user_id", user_id)
        .execute()
    )
    fixed_costs = sum(item["amount"] for item in (expenses_res.data or []))

    return {
        "monthly_income": profile.get("expected_monthly_income", 0),
        "fixed_costs": fixed_costs,
        "savings_target": profile.get("monthly_savings_target", 0),
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
    return await maybe_one(
        db.table("journey_regions")
        .select("id, region_id, status, started_at, ends_at")
        .eq("user_id", user_id)
        .eq("status", "CURRENT")
        .limit(1).maybe_single()
    )

async def fetch_active_challenge(db: AsyncClient, user_id: str) -> dict | None:
    result = await maybe_one(
        db.table("journey_challenges")
        .select("*")
        .eq("user_id", user_id)
        .in_("status", ["ACTIVE", "COMPLETED"])
        .eq("rewards_claimed", False)
        .order("started_at", desc=True)
        .limit(1)
        .limit(1).maybe_single()
    )
    if not result:
        return None
        
    # Map to frontend expected shape
    from app.journey.challenge_templates import get_template
    template_id = result.get("template_id", "unknown")
    try:
        template = get_template(template_id)
        title = template.title
        desc = template.description
        icon = template.icon
        color = template.color
    except KeyError:
        title = "Unknown Challenge"
        desc = "A challenge from an unknown template."
        icon = "ti-sword"
        color = "gray"
        
    from datetime import datetime, timezone
    try:
        ends_at = datetime.fromisoformat(result["ends_at"].replace("Z", "+00:00"))
        days_remaining = max(0, (ends_at.date() - datetime.now(timezone.utc).date()).days)
    except Exception:
        days_remaining = 0

    return {
        "id": result["id"],
        "type": template_id,
        "status": result.get("status", "ACTIVE"),
        "title": title,
        "description": desc,
        "icon": icon,
        "color": color,
        "days_remaining": days_remaining,
        "asset_key": None,
        "progress_data": result.get("progress_data", {}),
    }


async def upsert_daily_snapshot(
    db: AsyncClient,
    user_id: str,
    snapshot_date: str,
    updates: dict,
) -> None:
    if "zero_spend_marked" in updates:
        updates["zero_spend_xp_claimed"] = updates.pop("zero_spend_marked")

    existing = await maybe_one(
        db.table("journey_daily_survival")
        .select("user_id")
        .eq("user_id", user_id)
        .eq("tracking_date", snapshot_date)
        .limit(1).maybe_single()
    )
    if existing:
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

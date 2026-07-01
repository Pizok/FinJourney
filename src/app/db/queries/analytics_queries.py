"""
app/db/queries/analytics_queries.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Isolated, read-only PostgreSQL query layer for the Analytics module.

All GROUP BY aggregations live here — never in Python.
All functions are async and accept a Supabase AsyncClient as their first
argument. The analytics_service orchestrates concurrent calls via
asyncio.gather(); this module stays pure data-fetching with zero business
logic.
"""

from __future__ import annotations

import math
from datetime import date
from typing import Any
from uuid import UUID

from supabase import AsyncClient

from app.schemas.analytics import Granularity

# ── Internal constants ────────────────────────────────────────────────────────

_ANALYTICS_REQUIRED_LEVEL: int = 3
_TOP_TRANSACTIONS_LIMIT: int = 5
_CATEGORY_TOP_N: int = 10
_CASHFLOW_MAX_POINTS: int = 365
_DEBT_PROJECTION_LOOKBACK_MONTHS: int = 3

# Map Granularity enum → PostgreSQL DATE_TRUNC unit and TO_CHAR format string.
_GRANULARITY_MAP: dict[Granularity, tuple[str, str]] = {
    Granularity.DAILY:   ("day",   "YYYY-MM-DD"),
    Granularity.MONTHLY: ("month", "YYYY-MM"),
}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. CASHFLOW SERIES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_cashflow_series(
    db: AsyncClient,
    *,
    user_id: UUID | str,
    start_date: date,
    end_date: date,
    granularity: Granularity,
    user_tz: str,
) -> list[dict]:
    """Return a zero-padded time-series of income and expense totals."""
    res = await db.rpc("get_cashflow_series", {
        "p_user_id": str(user_id),
        "p_start_date": start_date.isoformat(),
        "p_end_date": end_date.isoformat(),
        "p_granularity": granularity.value,
        "p_user_tz": user_tz,
    }).execute()
    return res.data or []


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. CATEGORY BREAKDOWN
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_category_breakdown(
    db: AsyncClient,
    *,
    user_id: UUID | str,
    start_date: date,
    end_date: date,
) -> list[dict]:
    """Return per-category expense totals for the requested window."""
    res = await db.rpc("get_category_breakdown", {
        "p_user_id": str(user_id),
        "p_start_date": start_date.isoformat(),
        "p_end_date": end_date.isoformat(),
    }).execute()
    return res.data or []


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. TOP TRANSACTIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_top_transactions(
    db: AsyncClient,
    *,
    user_id: UUID | str,
    start_date: date,
    end_date: date,
) -> list[dict]:
    """Fetch the top 5 largest expense transactions within the requested window."""
    res = await db.table("transactions") \
        .select("id, amount, categories(name), wallets!transactions_primary_wallet_id_fkey(name), transaction_date, note") \
        .eq("user_id", str(user_id)) \
        .eq("type", "expense") \
        .is_("deleted_at", "null") \
        .is_("loan_id", "null") \
        .is_("savings_target_id", "null") \
        .gte("transaction_date", start_date.isoformat()) \
        .lte("transaction_date", end_date.isoformat()) \
        .order("amount", desc=True) \
        .limit(_TOP_TRANSACTIONS_LIMIT) \
        .execute()
    
    formatted = []
    for row in (res.data or []):
        formatted.append({
            "id": row["id"],
            "amount": row["amount"],
            "category_name": row.get("categories", {}).get("name") if row.get("categories") else "Uncategorized",
            "wallet_name": row.get("wallets", {}).get("name") if row.get("wallets") else "Unknown Wallet",
            "transaction_date": row["transaction_date"],
            "note": row["note"],
        })
    return formatted


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. MONTHLY DEBT PAYMENTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_monthly_debt_payments(
    db: AsyncClient,
    *,
    user_id: UUID | str,
    month_date: date,
) -> int:
    """Sum the monthly_installment of all active loans for the user."""
    res = await db.table("loans").select("monthly_installment").eq("user_id", str(user_id)).eq("status", "ACTIVE").execute()
    total = sum([item["monthly_installment"] for item in res.data]) if res.data else 0
    return int(total)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. AVERAGE MONTHLY DEBT PAYMENTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_avg_monthly_debt_payments(
    db: AsyncClient,
    *,
    user_id: UUID | str,
    lookback_months: int = _DEBT_PROJECTION_LOOKBACK_MONTHS,
) -> int:
    """Compute the rolling average of monthly debt-payment spending."""
    res = await db.rpc("get_avg_monthly_debt_payments", {
        "p_user_id": str(user_id),
        "p_months": lookback_months,
    }).execute()
    return int(res.data) if res.data is not None else 0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. WALLET SNAPSHOT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_wallet_snapshot(
    db: AsyncClient,
    *,
    user_id: UUID | str,
) -> dict:
    """Aggregate all wallet balances into the four analytics dimensions."""
    res = await db.rpc("get_wallet_snapshot", {
        "p_user_id": str(user_id)
    }).execute()
    # RPC returning TABLE(...) returns a list of objects. We need the first row.
    return res.data[0] if res.data else {}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 7. HISTORICAL STABILITY SCORE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_historical_stability_score(
    db: AsyncClient,
    *,
    user_id: UUID | str,
    target_date: date,
) -> int | None:
    """Fetch the financial_stability_score stored in daily_snapshots."""
    # The daily_snapshots table does not exist in the current schema.
    # Returns None which the scoring service interprets as a 0 trend.
    return None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 8. ACTIVE BASELINE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_active_baseline(
    db: AsyncClient,
    *,
    user_id: UUID | str,
) -> dict | None:
    """Fetch the user's most recent non-deleted baseline record."""
    res_profile = await db.table("journey_profiles") \
        .select("expected_monthly_income, monthly_savings_target") \
        .eq("id", str(user_id)) \
        .execute()
        
    if not res_profile.data:
        return None
        
    profile = res_profile.data[0]
    
    res_fixed = await db.table("fixed_expenses") \
        .select("amount") \
        .eq("user_id", str(user_id)) \
        .execute()
        
    fixed_costs = sum(row["amount"] for row in (res_fixed.data or []))
    
    return {
        "income": profile.get("expected_monthly_income") or 0,
        "fixed_costs": fixed_costs,
        "savings_target": profile.get("monthly_savings_target") or 0
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 9. PLAYER ACCESS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_player_access(
    db: AsyncClient,
    *,
    user_id: UUID | str,
) -> dict:
    """Fetch the player's current XP and compute their level in-database."""
    # Since we are dropping raw SQL, we fetch from journey_profiles directly.
    # The journey_profiles table already tracks total_xp and current_level.
    res = await db.table("journey_profiles") \
        .select("total_xp, current_level, is_dev_account") \
        .eq("id", str(user_id)) \
        .limit(1) \
        .execute()
    
    if res.data:
        return {
            "total_xp": res.data[0]["total_xp"],
            "current_level": res.data[0]["current_level"],
            "is_dev_account": bool(res.data[0].get("is_dev_account")),
        }
    return {"total_xp": 0, "current_level": 1, "is_dev_account": False}

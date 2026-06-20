from datetime import datetime, timezone

import pytz
from fastapi import APIRouter, HTTPException, status

from app.api.v1.dependencies import CurrentUser, DbClient
from app.db.queries.daily_queries import (
    fetch_baselines,
    fetch_daily_status,
    fetch_streak,
    upsert_daily_snapshot,
)
from app.db.queries.profile_queries import fetch_player_state, fetch_profile
from app.db.queries.transaction_queries import insert_game_event, update_player_state
from app.services.budget_service import calculate_daily_budget

router = APIRouter()


@router.get("/daily-status", summary="Today's budget and streak summary")
async def get_daily_status(user: CurrentUser, db: DbClient):
    profile = await fetch_profile(db, user["id"])
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")

    user_tz = profile.get("timezone", "UTC")

    daily_raw, baselines, streak = await _gather_daily_data(db, user["id"], user_tz)

    daily_budget = 0.0
    if baselines:
        daily_budget = calculate_daily_budget(
            baselines["monthly_income"],
            baselines["fixed_costs"],
            baselines["savings_target"],
        )
    spent_today = daily_raw.get("spent_today", 0.0)

    return {
        "success": True,
        "data": {
            "daily_budget": round(daily_budget, 2),
            "spent_today": round(spent_today, 2),
            "remaining_budget": round(daily_budget - spent_today, 2),
            "streak_count": streak,
            "zero_spend_marked": daily_raw.get("zero_spend_marked", False),
        },
    }


@router.post("/daily/zero-spend", summary="Mark today as a zero-spend day")
async def mark_zero_spend(user: CurrentUser, db: DbClient):
    """
    Marks today as zero-spend (once per day).
    Blocked if any expense transaction already exists for today.
    Awards a small XP bonus.
    """
    profile = await fetch_profile(db, user["id"])
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")

    user_tz_name = profile.get("timezone", "UTC")
    tz = pytz.timezone(user_tz_name)
    today_str = datetime.now(tz).date().isoformat()

    daily_raw = await fetch_daily_status(db, user["id"], user_tz_name)

    if daily_raw.get("zero_spend_marked"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Zero spend already marked for today.",
        )
    if daily_raw.get("spent_today", 0.0) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot mark zero spend: an expense was already logged today.",
        )

    await upsert_daily_snapshot(db, user["id"], today_str, {"zero_spend_marked": True})

    # XP reward
    _XP_REWARD = 15.0
    player_state = await fetch_player_state(db, user["id"])
    if player_state:
        await update_player_state(db, user["id"], xp=player_state["xp"] + _XP_REWARD)
        await insert_game_event(
            db=db,
            user_id=user["id"],
            event_type="CLEAN_CODE",
            xp_delta=_XP_REWARD,
            metadata={"reason": "zero_spend_day", "date": today_str},
        )

    return {"success": True, "data": {"zero_spend_marked": True, "xp_earned": _XP_REWARD}}


@router.post("/daily/use-standby", summary="Activate a standby token")
async def use_standby(user: CurrentUser, db: DbClient):
    """
    Consumes one standby token to freeze penalties for 24 hours.
    Each user has 7 tokens per year; no refill mid-year.
    """
    player_state = await fetch_player_state(db, user["id"])
    if not player_state:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player state not found.")

    tokens: int = player_state.get("standby_tokens", 0)
    if tokens <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No standby tokens remaining for this year.",
        )

    # Freeze expires at end of today (local midnight → UTC)
    profile = await fetch_profile(db, user["id"])
    user_tz = pytz.timezone(profile.get("timezone", "UTC") if profile else "UTC")
    now_local = datetime.now(user_tz)
    freeze_until = now_local.replace(
        hour=23, minute=59, second=59, microsecond=0
    ).astimezone(timezone.utc).isoformat()

    await update_player_state(
        db=db,
        user_id=user["id"],
        standby_tokens=tokens - 1,
        extra={"standby_active_until": freeze_until},
    )
    await insert_game_event(
        db=db,
        user_id=user["id"],
        event_type="STANDBY_USED",
        metadata={"tokens_remaining": tokens - 1, "freeze_until_utc": freeze_until},
    )

    return {
        "success": True,
        "data": {
            "standby_activated": True,
            "tokens_remaining": tokens - 1,
            "freeze_until_utc": freeze_until,
        },
    }


# ── Internal helpers ─────────────────────────────────────────────────────────

import asyncio


async def _gather_daily_data(db, user_id: str, user_tz: str):
    return await asyncio.gather(
        fetch_daily_status(db, user_id, user_tz),
        fetch_baselines(db, user_id),
        fetch_streak(db, user_id),
    )

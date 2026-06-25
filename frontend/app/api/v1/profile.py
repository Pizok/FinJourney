from fastapi import APIRouter, HTTPException, status

from app.api.v1.dependencies import CurrentUser, DbClient
from app.schemas.profile import ProfileSetupRequest, ProfileThemeRequest
from app.services.progression_service import calculate_level

router = APIRouter()


@router.get("/profile", summary="Get current profile + player state")
async def get_profile(user: CurrentUser, db: DbClient):
    # Fetch consolidated journey_profile directly
    result = await db.table("journey_profiles").select("*").eq("id", user.user_id).maybe_single().execute()
    profile = result.data

    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")

    return {
        "success": True,
        "data": {
            **profile,
            "level": calculate_level(profile.get("total_xp", 0.0)),
            "hp": profile.get("current_hp", 100.0),
            "xp": profile.get("total_xp", 0.0),
            "gold": profile.get("gold_coins", 0.0),
            "shield": profile.get("defense_shield", 0.0),
        },
    }


@router.get("/profile/check-username", summary="Check if username is available")
async def check_username(username: str, db: GetAdminDB):
    from app.schemas.profile import ProfileSetupRequest
    try:
        ProfileSetupRequest.valid_username(username)
    except ValueError as e:
        return {"success": True, "data": {"available": False, "reason": str(e)}}

    conflict = await (
        db.table("journey_profiles")
        .select("id")
        .eq("username", username)
        .maybe_single()
        .execute()
    )
    return {
        "success": True,
        "data": {"available": conflict.data is None}
    }


@router.patch("/profile/setup", summary="Complete onboarding setup")
async def setup_profile(user: CurrentUser, db: DbClient, payload: ProfileSetupRequest):
    # Username uniqueness check
    conflict = await (
        db.table("journey_profiles")
        .select("id")
        .eq("username", payload.username)
        .neq("id", user.user_id)
        .maybe_single()
        .execute()
    )
    if conflict.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Username is already taken."
        )

    result = await (
        db.table("journey_profiles")
        .update(
            {
                "username": payload.username,
                "avatar_class": payload.avatar_class,
                "avatar_key": payload.avatar_key,
                "timezone": payload.timezone,
                "has_completed_setup": True,
                "current_hp": 100.0,
                "total_xp": 0.0,
                "gold_coins": 0.0,
                "defense_shield": 0.0,
                "standby_tokens": 7,
            }
        )
        .eq("id", user.user_id)
        .execute()
    )

    return {"success": True, "data": result.data[0] if result.data else {}}


@router.patch("/profile/theme", summary="Equip an unlocked theme")
async def update_theme(user: CurrentUser, db: DbClient, payload: ProfileThemeRequest):
    # "clear-night" is always available; others require inventory ownership
    if payload.theme_key != "clear-night":
        owned = await (
            db.table("journey_inventory")
            .select("id")
            .eq("user_id", user.user_id)
            .eq("item_key", payload.theme_key)
            .maybe_single()
            .execute()
        )
        if not owned.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Theme not unlocked. Purchase it from the Guild Shop first.",
            )

    await (
        db.table("journey_profiles")
        .update({"active_theme": payload.theme_key})
        .eq("id", user.user_id)
        .execute()
    )
    return {"success": True, "data": {"active_theme": payload.theme_key}}


@router.post("/profile/baselines", summary="Save onboarding baselines and savings target")
async def save_baselines(user: CurrentUser, db: DbClient, payload: dict):
    from app.schemas.profile import BaselinesSetupRequest
    try:
        data = BaselinesSetupRequest(**payload)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    from datetime import datetime
    now = datetime.utcnow()
    month = now.month
    year = now.year

    # Process Incomes
    for entry in data.incomeEntries:
        await db.table("income_streams").insert({
            "user_id": user.user_id,
            "name": entry.label,
            "amount": entry.amount
        }).execute()

    # Process Fixed Costs
    for entry in data.fixedCostEntries:
        await db.table("fixed_expenses").insert({
            "user_id": user.user_id,
            "name": entry.label,
            "amount": entry.amount,
            "recurrence_type": "monthly",
            "recurrence_value": 1
        }).execute()

    # Process Savings Target
    if data.savingsTarget > 0:
        await db.table("savings_targets").insert({
            "user_id": user.user_id,
            "name": "General Savings",
            "target_amount": data.savingsTarget,
            "current_amount": 0,
            "status": "active"
        }).execute()

    # Update the cache scalars on journey_profiles
    total_income = sum(entry.amount for entry in data.incomeEntries)
    await db.table("journey_profiles").update({
        "expected_monthly_income": total_income,
        "monthly_savings_target": data.savingsTarget
    }).eq("id", user.user_id).execute()

    return {"success": True, "data": {}}

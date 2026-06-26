from fastapi import APIRouter, HTTPException, status

from app.api.v1.dependencies import CurrentUser, AuthUser, DbClient, GetAdminDB
from app.db.utils import maybe_one
from app.schemas.profile import ProfileSetupRequest, ProfileThemeRequest
from app.services.progression_service import calculate_level

router = APIRouter()


@router.get("/profile", summary="Get current profile + player state")
async def get_profile(user: AuthUser, db: DbClient):
    # Fetch consolidated journey_profile directly
    profile = await maybe_one(
        db.table("journey_profiles").select("*").eq("id", user.user_id).maybe_single()
    )

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

    try:
        result = await (
            db.table("journey_profiles")
            .select("id")
            .eq("username", username)
            .limit(1)
            .execute()
        )
        taken = bool(result.data)
        print(f"[check-username] username={username!r} taken={taken} data={result.data}")
        return {
            "success": True,
            "data": {"available": not taken}
        }
    except Exception as e:
        print(f"[check-username] ERROR: {type(e).__name__}: {e}")
        raise


@router.patch("/profile/setup", summary="Complete onboarding setup")
async def setup_profile(user: AuthUser, db: DbClient, payload: ProfileSetupRequest):
    # Username uniqueness check
    conflict = await maybe_one(
        db.table("journey_profiles")
        .select("id")
        .eq("username", payload.username)
        .neq("id", user.user_id)
        .maybe_single()
    )
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Username is already taken."
        )

    try:
        result = await (
            db.table("journey_profiles")
            .update(
                {
                    "username": payload.username,
                    "active_path": payload.avatar_class.upper(), # Path is an enum like 'SENTINEL', 'VANGUARD', 'PHANTOM' (Avatar class is used as path name here?)
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
    except Exception as e:
        print(f"[setup_profile] ERROR: {type(e).__name__}: {e}")
        raise


@router.patch("/profile/theme", summary="Equip an unlocked theme")
async def update_theme(user: AuthUser, db: DbClient, payload: ProfileThemeRequest):
    # "clear-night" is always available; others require inventory ownership
    if payload.theme_key != "clear-night":
        owned = await maybe_one(
            db.table("journey_inventory")
            .select("id")
            .eq("user_id", user.user_id)
            .eq("item_key", payload.theme_key)
            .maybe_single()
        )
        if not owned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Theme not unlocked. Purchase it from the Guild Shop first.",
            )

    profile_res = await db.table("journey_profiles").select("app_preferences").eq("id", user.user_id).maybe_single().execute()
    app_prefs = profile_res.data.get("app_preferences", {}) if profile_res.data else {}
    app_prefs["theme"] = payload.theme_key

    await (
        db.table("journey_profiles")
        .update({"app_preferences": app_prefs})
        .eq("id", user.user_id)
        .execute()
    )
    return {"success": True, "data": {"active_theme": payload.theme_key}}


@router.post("/profile/baselines", summary="Save onboarding baselines and savings target")
async def save_baselines(user: AuthUser, db: DbClient, payload: dict):
    from app.schemas.profile import BaselinesSetupRequest
    try:
        data = BaselinesSetupRequest(**payload)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    try:
        from datetime import datetime
        now = datetime.utcnow()
        month = now.month
        year = now.year

        # Clear existing baselines to avoid duplicates if onboarding is resubmitted
        await db.table("income_streams").delete().eq("user_id", user.user_id).execute()
        await db.table("fixed_expenses").delete().eq("user_id", user.user_id).execute()
        await db.table("savings_targets").delete().eq("user_id", user.user_id).execute()

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
                "recurrence_value": "1"
            }).execute()

        # Process Savings Targets
        total_monthly_savings = 0
        for entry in data.savingsEntries:
            if entry.monthly_contribution > 0:
                # Add the first of the month to the YYYY-MM deadline
                deadline_str = f"{entry.deadline}-01"
                await db.table("savings_targets").insert({
                    "user_id": user.user_id,
                    "name": entry.label,
                    "target_amount": entry.target_amount,
                    "monthly_contribution": entry.monthly_contribution,
                    "current_amount": 0,
                    "deadline": deadline_str,
                    "status": "active"
                }).execute()
                total_monthly_savings += entry.monthly_contribution

        # Update the cache scalars on journey_profiles
        total_income = sum(entry.amount for entry in data.incomeEntries)
        await db.table("journey_profiles").update({
            "expected_monthly_income": total_income,
            "monthly_savings_target": total_monthly_savings
        }).eq("id", user.user_id).execute()
        
        # Fire-and-forget trigger to seed the initial Journey region and node.
        # This is wrapped in a try/except so a failure here does not break the 
        # onboarding flow after the financial baselines are successfully saved.
        try:
            from app.journey.services.advancement_svc import evaluate_node_advancement
            await evaluate_node_advancement(db, user.user_id)
        except Exception as seed_err:
            print(f"[save_baselines] ERROR seeding journey state for {user.user_id}: {seed_err}")

        return {"success": True, "data": {}}
    except Exception as e:
        print(f"[save_baselines] ERROR: {type(e).__name__}: {e}")
        raise

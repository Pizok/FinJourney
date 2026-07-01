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
        db.table("journey_profiles").select("*").eq("id", user.user_id).limit(1).maybe_single()
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
        .limit(1).maybe_single()
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
        
        from app.journey.repos.inventory_repo import InventoryRepository
        inv_repo = InventoryRepository(db)
        await inv_repo.initialize_starter_tokens(user.user_id)
        
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
            .eq("type", "CONSUMABLE")
            .eq("status", "AVAILABLE")
            .eq("source_event_id", payload.theme_key)
            .limit(1).maybe_single()
        )
        if not owned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Theme not unlocked. Purchase it from the Guild Shop first.",
            )

    profile_res = await db.table("journey_profiles").select("app_preferences").eq("id", user.user_id).limit(1).maybe_single().execute()
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

        # 1. Convert Pydantic payloads to dictionaries for JSONB processing
        incomes_json = []
        for entry in data.incomeEntries:
            d = entry.model_dump()
            d["name"] = d.pop("label", "")
            incomes_json.append(d)

        fixed_costs_json = []
        for entry in data.fixedCostEntries:
            d = entry.model_dump()
            d["name"] = d.pop("label", "")
            d["recurrence_type"] = "monthly"
            d["recurrence_value"] = "1"
            fixed_costs_json.append(d)
        
        # Format savings deadlines for the RPC
        savings_json = []
        for entry in data.savingsEntries:
            if entry.monthly_contribution > 0:
                deadline_str = entry.deadline
                if len(deadline_str) == 7:
                    deadline_str = f"{deadline_str}-01"
                entry_dict = entry.model_dump()
                entry_dict["name"] = entry_dict.pop("label", "")
                entry_dict["deadline"] = deadline_str
                # Note: target_amount is what the payload has, and monthly_contribution
                # maps to monthly_contribution_target. We rename it for the RPC insert.
                entry_dict["monthly_contribution_target"] = entry.monthly_contribution
                savings_json.append(entry_dict)

        # 2. Execute Atomic DB Transaction via RPC
        # This replaces the ~10 sequential delete/insert HTTP calls.
        await db.rpc(
            "save_onboarding_baselines",
            {
                "p_user_id": user.user_id,
                "p_incomes": incomes_json,
                "p_fixed_costs": fixed_costs_json,
                "p_savings": savings_json
            }
        ).execute()

        # Seed Starter Categories (only if user has none)
        existing_categories = await db.table("categories").select("id").eq("user_id", user.user_id).is_("deleted_at", "null").limit(1).execute()
        if not existing_categories.data:
            import uuid
            now_utc = datetime.utcnow().isoformat()
            # Use constants for the budget amounts so they can be changed later
            STARTER_CATEGORIES = [
                {"name": "Food & Dining", "monthly_limit": 1000000},
                {"name": "Transport", "monthly_limit": 500000},
                {"name": "Bills & Utilities", "monthly_limit": 500000},
                {"name": "Miscellaneous", "monthly_limit": 0},
            ]
            category_inserts = [
                {
                    "id": str(uuid.uuid4()),
                    "user_id": user.user_id,
                    "name": cat["name"],
                    "category_group": "expense",
                    "monthly_limit": cat["monthly_limit"],
                    "created_at": now_utc,
                    "deleted_at": None,
                }
                for cat in STARTER_CATEGORIES
            ]
            try:
                await db.table("categories").insert(category_inserts).execute()
            except Exception as cat_err:
                # Log explicitly as requested so the silent failure isn't swallowed
                print(f"[save_baselines] ERROR seeding categories for {user.user_id}: {cat_err}")
        
        # Fire-and-forget trigger to seed the initial Journey region and node.
        # This is wrapped in a try/except so a failure here does not break the 
        # onboarding flow after the financial baselines are successfully saved.
        try:
            from app.journey.services.advancement_svc import evaluate_node_advancement
            await evaluate_node_advancement(db, user.user_id)
        except Exception as seed_err:
            print(f"[save_baselines] ERROR seeding journey state for {user.user_id}: {seed_err}")
            
        try:
            from app.journey.services.assignment_svc import ChallengeAssignmentService
            from app.journey.repos.profile_repo import ProfileRepository
            assignment_svc = ChallengeAssignmentService(db, ProfileRepository(db))
            await assignment_svc.evaluate_triggers(user.user_id, "onboarding_complete")
        except Exception as assign_err:
            print(f"[save_baselines] ERROR assigning FIRST_STEPS for {user.user_id}: {assign_err}")

        return {"success": True, "data": {}}
    except Exception as e:
        print(f"[save_baselines] ERROR: {type(e).__name__}: {e}")
        raise

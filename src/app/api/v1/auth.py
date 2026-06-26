from fastapi import APIRouter, status
from app.api.v1.dependencies import AuthUser, DbClient
from app.db.utils import maybe_one

router = APIRouter()

@router.post("/auth/sync", summary="Sync Supabase user to public.journey_profiles")
async def sync_user(user: AuthUser, db: DbClient):
    """
    Called by the Next.js auth callback after exchanging the OAuth code.
    Ensures that the user has a row in public.journey_profiles.
    """
    profile = await maybe_one(
        db.table("journey_profiles")
        .select("has_completed_setup")
        .eq("id", user.user_id)
        .maybe_single()
    )

    if profile:
        return {
            "success": True, 
            "data": {"has_completed_setup": profile.get("has_completed_setup", False)}
        }

    # If the user doesn't exist in public.journey_profiles, create a placeholder.
    # We don't have the email from AuthUser (only sub and level), but that's okay.
    # The username will be collected during onboarding.
    # We will use a temporary username (uuid) and they will change it during setup.
    temp_username = f"user_{user.user_id[:8]}"
    
    await (
        db.table("journey_profiles")
        .insert({
            "id": user.user_id,
            "username": temp_username,
            "has_completed_setup": False
        })
        .execute()
    )

    return {
        "success": True, 
        "data": {"has_completed_setup": False}
    }

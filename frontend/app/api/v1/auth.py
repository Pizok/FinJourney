from fastapi import APIRouter, status
from app.api.v1.dependencies import AuthUser, DbClient

router = APIRouter()

@router.post("/auth/sync", summary="Sync Supabase user to public.profiles")
async def sync_user(user: AuthUser, db: DbClient):
    """
    Called by the Next.js auth callback after exchanging the OAuth code.
    Ensures that the user has a row in public.profiles.
    """
    profile_res = await (
        db.table("profiles")
        .select("has_completed_setup")
        .eq("id", user.user_id)
        .maybe_single()
        .execute()
    )

    if profile_res.data:
        return {
            "success": True, 
            "data": {"has_completed_setup": profile_res.data.get("has_completed_setup", False)}
        }

    # If the user doesn't exist in public.profiles, create a placeholder.
    # We don't have the email from AuthUser (only sub and level), but that's okay.
    # The username will be collected during onboarding.
    # We will use a temporary username (uuid) and they will change it during setup.
    temp_username = f"user_{user.user_id[:8]}"
    
    await (
        db.table("profiles")
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

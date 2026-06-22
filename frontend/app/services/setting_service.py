"""
setting_service.py

Implementation of the FinJourney Settings Domain.
"""

from typing import Any
from datetime import datetime, timezone, timedelta
from uuid import UUID

from pydantic import BaseModel
from supabase import AsyncClient

from app.db.queries import settings_queries
from app.schemas.settings_responses import (
    SettingsHydrationResponse,
    CooldownMeta,
    ProfilePayload,
    ProgressionPayload,
    FinancialsPayload,
    AppPreferencesPayload,
    NotificationSettingsPayload,
    ActivePathPayload
)
from app.schemas.settings_requests import (
    PatchProfileRequest,
    PatchFinancialsRequest,
    PatchPreferencesRequest,
    PatchNotificationsRequest,
    PathChangeRequest,
    ResetProgressRequest
)

class SettingsDomainError(Exception):
    def __init__(self, code: str, message: str, meta: dict[str, Any] | None = None, http_status: int = 400):
        self.code = code
        self.message = message
        self.meta = meta
        self.http_status = http_status

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)

async def get_settings_hydration(db: AsyncClient, user_id: UUID) -> SettingsHydrationResponse:
    profile_data = await settings_queries.fetch_settings_profile(db, str(user_id))
    if not profile_data:
        raise SettingsDomainError("USER_NOT_FOUND", "Profile not found", http_status=404)

    # 1. Profile Payload
    profile = ProfilePayload(
        user_id=user_id,
        username=profile_data.get("username", ""),
        avatar_class=profile_data.get("avatar_class", ""),
        timezone=profile_data.get("timezone", "UTC"),
        primary_payday=profile_data.get("primary_payday"),
        setup_status="completed" if profile_data.get("onboarding_complete") else "pending",
        active_theme=profile_data.get("active_theme", "clear-night")
    )

    # 2. Progression Payload (Gold, Shield, Standby are defaulted to 0 per new schema)
    # The new schema drops these from profile, likely moving them to inventory or removing them.
    progression = ProgressionPayload(
        current_hp=int(profile_data.get("current_hp") or 0),
        total_xp=int(profile_data.get("total_xp") or 0),
        level=int(profile_data.get("current_level") or 1),
        current_gold=0.0,
        current_shield=0.0,
        standby_tokens=0
    )

    # 3. Financials
    income = float(profile_data.get("expected_monthly_income") or 0.0)
    savings = float(profile_data.get("monthly_savings_target") or 0.0)
    
    fixed_costs_data = await settings_queries.fetch_fixed_costs(db, str(user_id))
    fixed_costs = fixed_costs_data["total_fixed_costs"]
    
    safe_budget = max(0.0, (income - fixed_costs - savings) / 30.0)

    financials = FinancialsPayload(
        expected_monthly_income=income,
        monthly_savings_target=savings,
        fixed_costs=fixed_costs,
        projected_safe_daily_budget=safe_budget
    )

    # 4. Preferences
    prefs_raw = profile_data.get("app_preferences") or {}
    preferences = AppPreferencesPayload(
        theme=prefs_raw.get("theme", "clear-night"),
        reduced_motion=prefs_raw.get("reduced_motion", False),
        privacy_mode=prefs_raw.get("privacy_mode", False)
    )

    # 5. Notifications
    notifs_raw = profile_data.get("notification_settings") or {}
    notifications = NotificationSettingsPayload(
        daily_reminder=notifs_raw.get("daily_reminder", True),
        hazard_alerts=notifs_raw.get("hazard_alerts", True),
        achievement_notifications=notifs_raw.get("achievement_notifications", True)
    )

    # 6. Active Path
    path_key = profile_data.get("active_path") or "UNASSIGNED"
    active_path = ActivePathPayload(
        path_key=path_key,
        display_name=path_key.replace("_", " ").title(),
        changed_at=None, # Missing from PRD select
        cooldown_until=profile_data.get("path_cooldown_until")
    )

    # 7. Cooldown Meta
    meta = CooldownMeta(
        timezone_locked_until=profile_data.get("last_timezone_change_at"),
        username_locked_until=profile_data.get("last_username_change_at"),
        path_cooldown_until=profile_data.get("path_cooldown_until")
    )

    return SettingsHydrationResponse(
        success=True,
        meta=meta,
        profile=profile,
        progression=progression,
        financials=financials,
        preferences=preferences,
        notifications=notifications,
        active_path=active_path
    )

async def get_fixed_costs(db: AsyncClient, user_id: UUID) -> dict[str, Any]:
    return await settings_queries.fetch_fixed_costs(db, str(user_id))

async def patch_profile(db: AsyncClient, user_id: UUID, body: PatchProfileRequest) -> dict[str, Any]:
    # Check cooldowns if username or timezone is changed
    profile_data = await settings_queries.fetch_settings_profile(db, str(user_id))
    if not profile_data:
        raise SettingsDomainError("USER_NOT_FOUND", "Profile not found", http_status=404)
        
    now = _now_utc()
    updates = {}

    if body.username is not None and body.username != profile_data.get("username"):
        last_change_str = profile_data.get("last_username_change_at")
        if last_change_str:
            last_change = datetime.fromisoformat(last_change_str.replace("Z", "+00:00"))
            if now < last_change:
                raise SettingsDomainError(
                    "USERNAME_ON_COOLDOWN", 
                    "Username change is on a 30-day cooldown.",
                    meta={"locked_until": last_change.isoformat()}
                )
        updates["username"] = body.username
        updates["last_username_change_at"] = (now + timedelta(days=30)).isoformat()

    if body.timezone is not None and body.timezone != profile_data.get("timezone"):
        last_change_str = profile_data.get("last_timezone_change_at")
        if last_change_str:
            last_change = datetime.fromisoformat(last_change_str.replace("Z", "+00:00"))
            if now < last_change:
                raise SettingsDomainError(
                    "TIMEZONE_ON_COOLDOWN", 
                    "Timezone change is on a 30-day cooldown.",
                    meta={"locked_until": last_change.isoformat()}
                )
        updates["timezone"] = body.timezone
        updates["last_timezone_change_at"] = (now + timedelta(days=30)).isoformat()

    if body.primary_payday is not None:
        if not (1 <= body.primary_payday <= 31):
            raise SettingsDomainError("INVALID_PAYDAY", "Payday must be between 1 and 31")
        updates["primary_payday"] = body.primary_payday

    if updates:
        try:
            await settings_queries.update_profile(db, str(user_id), updates)
        except Exception as e:
            if "unique" in str(e).lower():
                raise SettingsDomainError("USERNAME_TAKEN", "Username already exists")
            raise e

    return {"patched": list(updates.keys())}

async def patch_financials(db: AsyncClient, user_id: UUID, body: PatchFinancialsRequest) -> dict[str, Any]:
    updates = {}
    if body.expected_monthly_income is not None:
        updates["expected_monthly_income"] = body.expected_monthly_income
    if body.monthly_savings_target is not None:
        updates["monthly_savings_target"] = body.monthly_savings_target

    if updates:
        # Validate that savings <= income - fixed_costs
        profile_data = await settings_queries.fetch_settings_profile(db, str(user_id))
        fixed_costs_data = await settings_queries.fetch_fixed_costs(db, str(user_id))
        
        income = float(updates.get("expected_monthly_income", profile_data.get("expected_monthly_income") or 0.0))
        savings = float(updates.get("monthly_savings_target", profile_data.get("monthly_savings_target") or 0.0))
        fixed = float(fixed_costs_data["total_fixed_costs"])
        
        if savings > (income - fixed):
            raise SettingsDomainError(
                "INVALID_SAVINGS_TARGET", 
                "Savings target exceeds available income after fixed costs.",
                meta={"available": max(0.0, income - fixed)}
            )
            
        await settings_queries.update_financials(db, str(user_id), updates)
        
        # Return recalculated budget
        safe_budget = max(0.0, (income - fixed - savings) / 30.0)
        return {"projected_safe_daily_budget": safe_budget}
    return {}

async def patch_preferences(db: AsyncClient, user_id: UUID, body: PatchPreferencesRequest) -> dict[str, Any]:
    profile_data = await settings_queries.fetch_settings_profile(db, str(user_id))
    prefs = profile_data.get("app_preferences") or {}
    
    if body.theme is not None: prefs["theme"] = body.theme
    if body.reduced_motion is not None: prefs["reduced_motion"] = body.reduced_motion
    if body.privacy_mode is not None: prefs["privacy_mode"] = body.privacy_mode
    
    await settings_queries.update_preferences(db, str(user_id), prefs)
    return prefs

async def patch_notifications(db: AsyncClient, user_id: UUID, body: PatchNotificationsRequest) -> dict[str, Any]:
    profile_data = await settings_queries.fetch_settings_profile(db, str(user_id))
    notifs = profile_data.get("notification_settings") or {}
    
    if body.daily_reminder is not None: notifs["daily_reminder"] = body.daily_reminder
    if body.hazard_alerts is not None: notifs["hazard_alerts"] = body.hazard_alerts
    if body.achievement_notifications is not None: notifs["achievement_notifications"] = body.achievement_notifications
    
    await settings_queries.update_notifications(db, str(user_id), notifs)
    return notifs

async def post_path_change(db: AsyncClient, user_id: UUID, body: PathChangeRequest, bus: Any) -> dict[str, Any]:
    profile_data = await settings_queries.fetch_settings_profile(db, str(user_id))
    if not profile_data:
        raise SettingsDomainError("USER_NOT_FOUND", "Profile not found", http_status=404)
        
    old_path = profile_data.get("active_path") or "UNASSIGNED"
    
    if body.new_path == old_path:
        raise SettingsDomainError("PATH_ALREADY_ACTIVE", f"Path {body.new_path} is already active.")
        
    cooldown_str = profile_data.get("path_cooldown_until")
    now = _now_utc()
    if cooldown_str:
        cooldown_until = datetime.fromisoformat(cooldown_str.replace("Z", "+00:00"))
        if now < cooldown_until:
            raise SettingsDomainError("PATH_CHANGE_LOCKED", "Path change is on a 6-month cooldown.")
            
    new_cooldown = now + timedelta(days=180)
    
    await settings_queries.update_path(db, str(user_id), body.new_path, new_cooldown.isoformat())
    
    from app.journey.repos.event_repo import EventRepository
    key = EventRepository.build_idempotency_key(
        str(user_id), now.isoformat()[:10], "path_change", suffix=str(int(now.timestamp()))
    )
    await bus.emit(
        user_id=str(user_id),
        event_type="PATH_CHANGED",
        source="SYSTEM",
        severity="INFO",
        idempotency_key=key,
        payload={"old_path": old_path, "new_path": body.new_path}
    )
    return {"status": "enqueued", "active_path": body.new_path}

async def post_reset_progress(db: AsyncClient, user_id: UUID, body: ResetProgressRequest, bus: Any) -> dict[str, Any]:
    # 1. Execute database updates in a single transaction via RPC
    await settings_queries.reset_user_progress_txn(db, str(user_id))
        
    # 2. Emit PROGRESS_RESET event
    from app.journey.repos.event_repo import EventRepository
    now = _now_utc()
    key = EventRepository.build_idempotency_key(
        str(user_id), now.isoformat()[:10], "progress_reset", suffix=str(int(now.timestamp()))
    )
    await bus.emit(
        user_id=str(user_id),
        event_type="PROGRESS_RESET",
        source="SYSTEM",
        severity="CRITICAL",
        idempotency_key=key,
        payload={"reset_scope": ["hp", "xp", "level", "streak"], "timestamp": now.isoformat()}
    )
    return {"success": True, "message": "Progress has been reset."}

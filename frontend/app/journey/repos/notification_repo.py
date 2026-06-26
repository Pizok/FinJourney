"""
app/journey/repos/notification_repo.py

Reads notification preference settings for a user from journey_profiles.

Used by event handlers to gate email sends on the user's configured
notification preferences (daily_reminder, hazard_alerts,
achievement_notifications).

Design contract:
  - All functions return safe defaults on failure (True = emails on).
  - Errors are logged at WARNING level; never re-raised.
  - This is a thin repo -- no caching, no mutations.
"""
from __future__ import annotations

import logging

from supabase import AsyncClient

logger = logging.getLogger(__name__)

# Safe defaults: if the pref record is missing, email as if everything is on.
_DEFAULT_PREFS: dict[str, bool] = {
    "daily_reminder": True,
    "hazard_alerts": True,
    "achievement_notifications": True,
}


async def get_notification_prefs(db: AsyncClient, user_id: str) -> dict[str, bool]:
    """
    Returns the notification_settings JSONB for user_id from journey_profiles.

    Args:
        db:      Supabase AsyncClient.
        user_id: UUID string of the target user.

    Returns:
        Dict with keys: daily_reminder, hazard_alerts, achievement_notifications.
        Each value is a bool. Returns _DEFAULT_PREFS on any failure.
    """
    try:
        response = await (
            db.table("journey_profiles")
            .select("notification_settings")
            .eq("id", user_id)
            .single()
            .execute()
        )
        if not response.data:
            logger.debug(
                "notification_repo: no profile found for user_id=%s, using defaults.",
                user_id,
            )
            return dict(_DEFAULT_PREFS)

        notif_settings = response.data.get("notification_settings") or {}
        return {
            "daily_reminder": bool(notif_settings.get("daily_reminder", True)),
            "hazard_alerts": bool(notif_settings.get("hazard_alerts", True)),
            "achievement_notifications": bool(
                notif_settings.get("achievement_notifications", True)
            ),
        }
    except Exception as exc:
        logger.warning(
            "notification_repo.get_notification_prefs: failed for user_id=%s -- %s. "
            "Returning default prefs.",
            user_id, exc,
        )
        return dict(_DEFAULT_PREFS)

"""
src/backend/journey/repositories/profile_repo.py

Supabase data access layer for all profile-adjacent Journey Engine tables:
  - journey_profiles       (player identity, HP, XP, path, vitality)
  - journey_daily_survival (ghost-penalty protection state per day)
  - journey_daily_xp       (daily XP cap tracking per action type)
  - journey_challenges     (quarterly review lifecycle)
  - journey_regions        (365-day macro-environment progression)
  - journey_notifications  (player inbox)
  - journey_journal        (immutable activity log)
  - journey_unlock_events  (level-up feature unlock acknowledgement)

Design rules:
  - All methods are async.
  - Repositories are pure data access — no business logic, no HP/XP calculations.
  - All writes are scoped to user_id to enforce RLS safety at the application layer.
  - Timezone-aware timestamps are always serialized via .isoformat().
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Optional

from supabase import AsyncClient

logger = logging.getLogger(__name__)

_NOW = lambda: datetime.now(timezone.utc).isoformat()  # noqa: E731


class ProfileRepository:
    """
    Provides typed async accessors for the journey_profiles table
    and all directly related player-state tables.
    """

    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    # ------------------------------------------------------------------
    # journey_profiles
    # ------------------------------------------------------------------

    async def get_profile(self, user_id: str) -> dict | None:
        """
        Fetches the full profile row for a player.
        Returns None if the user has not completed onboarding.
        """
        result = await (
            self._db
            .table("journey_profiles")
            .select("*")
            .eq("id", user_id)
            .limit(1).maybe_single()
            .execute()
        )
        return result.data

    async def update_hp_and_vitality(
        self,
        user_id: str,
        new_hp: int,
        vitality: str,
    ) -> dict:
        """
        Persists a resolved HP value and the derived vitality state string
        ("NORMAL" | "HAZARD" | "CRITICAL_FAILURE").

        HP is clamped 0–100 here as a final safeguard, but HPService is
        responsible for applying the correct clamping before calling this.
        """
        payload = {
            "current_hp": max(0, min(100, new_hp)),
            "vitality": vitality,
            "updated_at": _NOW(),
        }
        result = await (
            self._db
            .table("journey_profiles")
            .update(payload)
            .eq("id", user_id)
            .execute()
        )
        return result.data[0]

    async def update_xp_and_level(
        self,
        user_id: str,
        total_xp: int,
        current_level: int,
    ) -> dict:
        """
        Atomically persists the new total_xp and the level derived from it.
        Must only be called from XPService after the sqrt formula is applied.
        Frontend must never cache level independently of this value.
        """
        payload = {
            "total_xp": max(0, total_xp),
            "current_level": max(1, current_level),
            "updated_at": _NOW(),
        }
        result = await (
            self._db
            .table("journey_profiles")
            .update(payload)
            .eq("id", user_id)
            .execute()
        )
        return result.data[0]

    async def set_path_and_cooldown(
        self,
        user_id: str,
        path: str,
        cooldown_until: datetime,
    ) -> dict:
        """
        Applies a path change and writes the 6-month cooldown timestamp.
        The previous path is not stored — path history lives in game_events.
        """
        payload = {
            "active_path": path,
            "path_cooldown_until": cooldown_until.isoformat(),
            "updated_at": _NOW(),
        }
        result = await (
            self._db
            .table("journey_profiles")
            .update(payload)
            .eq("id", user_id)
            .execute()
        )
        return result.data[0]

    async def get_users_by_timezone(self, iana_timezone: str) -> list[str]:
        """
        Returns all active user IDs in a given IANA timezone bucket.
        Used by the rolling midnight cron job to batch Ghost Penalty evaluations.
        Only returns users who have completed setup (active players).
        """
        result = await (
            self._db
            .table("journey_profiles")
            .select("id")
            .eq("timezone", iana_timezone)
            .eq("has_completed_setup", True)
            .execute()
        )
        return [row["id"] for row in (result.data or [])]

    # ------------------------------------------------------------------
    # journey_daily_survival
    # ------------------------------------------------------------------

    async def get_daily_survival(self, user_id: str, tracking_date_iso: str) -> dict | None:
        """
        Fetches the player's daily survival row for a given date.
        """
        result = await (
            self._db
            .table("journey_daily_survival")
            .select("*")
            .eq("user_id", user_id)
            .eq("tracking_date", tracking_date_iso)
            .limit(1).maybe_single()
            .execute()
        )
        return result.data if result is not None else None

    async def advance_daily_survival_to_date(
        self,
        user_id: str,
        new_date: date,
    ) -> dict:
        """
        Advances the survival row to a new calendar date, resetting status to PENDING.
        Called by the midnight cron AFTER evaluating the previous day's state.

        Uses upsert so the row is created automatically on a player's first day.
        consecutive_clean_days is intentionally NOT reset here — it carries across days.
        """
        payload = {
            "user_id": user_id,
            "tracking_date": new_date.isoformat(),
            "status": "PENDING",
            "expense_xp_claimed": False,
            "income_xp_claimed": False,
            "zero_spend_xp_claimed": False,
            "updated_at": _NOW(),
        }
        result = await (
            self._db
            .table("journey_daily_survival")
            .upsert(payload, on_conflict="user_id,tracking_date")
            .execute()
        )
        return result.data[0]

    async def set_survival_status(
        self,
        user_id: str,
        current_date: date,
        status: str,
    ) -> dict:
        """
        Transitions the daily survival state machine.

        Valid transitions:
          PENDING      → SAFE_LOGGED   (any transaction logged)
          PENDING      → SAFE_CLAIMED  (zero-spend claimed)
          SAFE_CLAIMED → SAFE_LOGGED   (expense logged after zero-spend claim — revocation)

        The current_date guard ensures stale updates from slow event processors
        do not accidentally mutate a row that has already advanced to the next day.
        """
        payload = {
            "status": status,
            "updated_at": _NOW(),
        }
        result = await (
            self._db
            .table("journey_daily_survival")
            .update(payload)
            .eq("user_id", user_id)
            .eq("tracking_date", current_date.isoformat())
            .execute()
        )
        if not result.data:
            logger.warning(
                "set_survival_status: no row updated for user=%s date=%s status=%s. "
                "Row may have already advanced to a new date.",
                user_id, current_date, status,
            )
            return {}
        return result.data[0]

    async def mark_evaluated(self, user_id: str, current_date: date) -> None:
        """
        Stamps the last_evaluated_at timestamp on the survival row after midnight processing.
        Used for operational monitoring and idempotency verification.
        """
        await (
            self._db
            .table("journey_daily_survival")
            .update({
                "last_evaluated_at": _NOW(),
                "updated_at": _NOW(),
            })
            .eq("user_id", user_id)
            .eq("tracking_date", current_date.isoformat())
            .execute()
        )

    async def get_consecutive_clean_days(self, user_id: str) -> int:
        """Returns the current under-budget streak count for Shield generation checks."""
        result = await (
            self._db
            .table("journey_daily_survival")
            .select("consecutive_clean_days")
            .eq("user_id", user_id)
            .order("tracking_date", desc=True)
            .limit(1).maybe_single()
            .execute()
        )
        if not result.data:
            return 0
        return result.data.get("consecutive_clean_days", 0)

    async def increment_consecutive_clean_days(self, user_id: str) -> int:
        """
        Reads the current streak, increments by one, and writes the result.
        Returns the new streak count for the caller to check the 7-day shield trigger.

        Note: This is a read-modify-write. For true atomicity, prefer a Supabase RPC
        function (increment_clean_days) in production at scale.
        """
        current = await self.get_consecutive_clean_days(user_id)
        new_count = current + 1
        await (
            self._db
            .table("journey_daily_survival")
            .update({
                "consecutive_clean_days": new_count,
                "updated_at": _NOW(),
            })
            .eq("user_id", user_id)
            .execute()
        )
        logger.debug(
            "Clean day streak incremented: user=%s streak=%d", user_id, new_count
        )
        return new_count

    async def reset_consecutive_clean_days(self, user_id: str) -> None:
        """
        Resets the clean-day streak to 0 after a Shield is generated
        or after a Daily Bleed event (overspend) disrupts the streak.
        """
        await (
            self._db
            .table("journey_daily_survival")
            .update({
                "consecutive_clean_days": 0,
                "updated_at": _NOW(),
            })
            .eq("user_id", user_id)
            .execute()
        )

    # ------------------------------------------------------------------
    # journey_daily_xp
    # ------------------------------------------------------------------

    async def get_daily_xp_record(
        self, user_id: str, current_date: date
    ) -> dict | None:
        """
        Fetches the XP cap tracking row for a specific calendar date.
        Returns None if no transactions have been processed yet today.
        """
        result = await (
            self._db
            .table("journey_daily_survival")
            .select("*")
            .eq("user_id", user_id)
            .eq("tracking_date", current_date.isoformat())
            .limit(1).maybe_single()
            .execute()
        )
        return result.data

    async def ensure_daily_xp_record(
        self, user_id: str, current_date: date
    ) -> dict:
        """
        Gets or creates the daily XP cap row for today via upsert.
        ignore_duplicates=True ensures existing rows are never overwritten.
        Always re-fetches after upsert to return the live state.
        """
        payload = {
            "user_id": user_id,
            "tracking_date": current_date.isoformat(),
            "status": "PENDING",
            "expense_xp_claimed": False,
            "income_xp_claimed": False,
            "zero_spend_xp_claimed": False,
        }
        await (
            self._db
            .table("journey_daily_survival")
            .upsert(payload, on_conflict="user_id,tracking_date", ignore_duplicates=True)
            .execute()
        )
        return await self.get_daily_xp_record(user_id, current_date)

    async def mark_expense_xp_claimed(
        self, user_id: str, current_date: date
    ) -> dict:
        """
        Flags expense XP as claimed for today. Idempotent.
        Subsequent expense logs will update the budget but grant 0 XP.
        """
        result = await (
            self._db
            .table("journey_daily_survival")
            .update({
                "expense_xp_claimed": True,
                "updated_at": _NOW(),
            })
            .eq("user_id", user_id)
            .eq("tracking_date", current_date.isoformat())
            .execute()
        )
        return result.data[0]

    async def mark_income_xp_claimed(
        self, user_id: str, current_date: date
    ) -> dict:
        """
        Flags income XP as claimed for today. Idempotent.
        Subsequent income logs update the wallet but grant 0 XP.
        """
        result = await (
            self._db
            .table("journey_daily_survival")
            .update({
                "income_xp_claimed": True,
                "updated_at": _NOW(),
            })
            .eq("user_id", user_id)
            .eq("tracking_date", current_date.isoformat())
            .execute()
        )
        return result.data[0]

    async def mark_zero_spend_xp_claimed(
        self, user_id: str, current_date: date
    ) -> dict:
        """Flags zero-spend XP as claimed for today."""
        result = await (
            self._db
            .table("journey_daily_survival")
            .update({
                "zero_spend_xp_claimed": True,
                "updated_at": _NOW(),
            })
            .eq("user_id", user_id)
            .eq("tracking_date", current_date.isoformat())
            .execute()
        )
        return result.data[0]

    async def revoke_zero_spend_xp(
        self, user_id: str, current_date: date
    ) -> dict:
        """
        Resets zero_spend_xp_claimed to False when an expense is logged
        after a Zero-Spend claim (SAFE_CLAIMED → SAFE_LOGGED revocation).
        The service layer must also subtract the previously awarded XP.
        """
        result = await (
            self._db
            .table("journey_daily_survival")
            .update({
                "zero_spend_xp_claimed": False,
                "updated_at": _NOW(),
            })
            .eq("user_id", user_id)
            .eq("tracking_date", current_date.isoformat())
            .execute()
        )
        logger.info(
            "Zero-spend XP revoked for user=%s date=%s (expense logged after claim).",
            user_id, current_date,
        )
        return result.data[0]

    # ------------------------------------------------------------------
    # journey_challenges
    # ------------------------------------------------------------------

    async def get_active_challenge(self, user_id: str) -> dict | None:
        """
        Returns the player's current challenge in ACTIVE or COMPLETED state.
        COMPLETED means rewards have not yet been claimed — it still surfaces in the UI.
        Returns None only during the brief PREPARING system transition.
        """
        result = await (
            self._db
            .table("journey_challenges")
            .select("*")
            .eq("user_id", user_id)
            .in_("status", ["ACTIVE", "COMPLETED"])
            .order("started_at", desc=True)
            .limit(1).maybe_single()
            .execute()
        )
        return result.data if result is not None else None

    async def get_challenge_by_id(
        self, user_id: str, challenge_id: str
    ) -> dict | None:
        """
        Fetches a specific challenge record scoped to the requesting user.
        Prevents cross-user access at the repository layer as a secondary safeguard.
        """
        result = await (
            self._db
            .table("journey_challenges")
            .select("*")
            .eq("id", challenge_id)
            .eq("user_id", user_id)
            .limit(1).maybe_single()
            .execute()
        )
        return result.data

    async def update_challenge_status(
        self, challenge_id: str, status: str
    ) -> dict:
        """Transitions a challenge to COMPLETED, FAILED, or ARCHIVED."""
        result = await (
            self._db
            .table("journey_challenges")
            .update({"status": status})
            .eq("id", challenge_id)
            .execute()
        )
        return result.data[0]

    async def mark_challenge_rewards_claimed(self, challenge_id: str) -> dict:
        """Sets rewards_claimed=True after the player collects their quarterly rewards."""
        result = await (
            self._db
            .table("journey_challenges")
            .update({"rewards_claimed": True})
            .eq("id", challenge_id)
            .execute()
        )
        return result.data[0]

    async def insert_challenge(self, payload: dict) -> dict:
        """
        Creates a new challenge record. Called by CronService after the
        PREPARING → ACTIVE transition at the start of a new quarter.
        """
        result = await (
            self._db
            .table("journey_challenges")
            .insert(payload)
            .execute()
        )
        return result.data[0]

    async def list_archived_challenges(
        self,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict]:
        """Returns a paginated list of historical (ARCHIVED) challenges."""
        result = await (
            self._db
            .table("journey_challenges")
            .select("*")
            .eq("user_id", user_id)
            .eq("status", "ARCHIVED")
            .order("started_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data or []

    async def get_stalled_preparing_challenges(
        self, stalled_threshold_hours: int = 24
    ) -> list[dict]:
        """
        Returns PREPARING challenges older than the threshold.
        Used by the Daily Janitor to clean up orphaned challenge states.
        """
        from datetime import timedelta

        cutoff = (
            datetime.now(timezone.utc) - timedelta(hours=stalled_threshold_hours)
        ).isoformat()

        result = await (
            self._db
            .table("journey_challenges")
            .select("*")
            .eq("status", "PREPARING")
            .lt("created_at", cutoff)
            .execute()
        )
        return result.data or []

    # ------------------------------------------------------------------
    # journey_regions
    # ------------------------------------------------------------------

    async def get_current_region(self, user_id: str) -> dict | None:
        """Fetches the player's active CURRENT region row."""
        result = await (
            self._db
            .table("journey_regions")
            .select("*")
            .eq("user_id", user_id)
            .eq("status", "CURRENT")
            .limit(1).maybe_single()
            .execute()
        )
        return result.data

    async def update_region_status(
        self, region_id: str, status: str
    ) -> dict:
        """
        Transitions the region state machine:
          CURRENT → SHIFT_PENDING → SHIFTED
        A new CURRENT row is created by create_new_region immediately after SHIFTED.
        """
        result = await (
            self._db
            .table("journey_regions")
            .update({"status": status})
            .eq("id", region_id)
            .execute()
        )
        return result.data[0]

    async def create_new_region(
        self,
        user_id: str,
        region_id: str,
        started_at: datetime,
        ends_at: datetime,
    ) -> dict:
        """
        Inserts the next region row after a successful 365-day Region Shift.
        region_id must be a valid key from the region_catalog.
        """
        payload = {
            "user_id": user_id,
            "region_id": region_id,
            "status": "CURRENT",
            "started_at": started_at.isoformat(),
            "ends_at": ends_at.isoformat(),
        }
        result = await (
            self._db
            .table("journey_regions")
            .insert(payload)
            .execute()
        )
        logger.info(
            "New region created: user=%s region=%s starts=%s",
            user_id, region_id, started_at.isoformat(),
        )
        return result.data[0]

    # ------------------------------------------------------------------
    # journey_notifications
    # ------------------------------------------------------------------

    async def get_notifications(
        self,
        user_id: str,
        status: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict]:
        """Returns paginated notifications, optionally filtered by status."""
        query = (
            self._db
            .table("journey_notifications")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if status:
            query = query.eq("status", status)
        result = await query.execute()
        return result.data or []

    async def count_unread_notifications(self, user_id: str) -> int:
        """Efficient count query for the unread badge rendered in the bootstrap payload."""
        result = await (
            self._db
            .table("journey_notifications")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("status", "UNREAD")
            .execute()
        )
        return result.count or 0

    async def update_notification_status(
        self,
        notification_id: str,
        user_id: str,
        status: str,
    ) -> dict:
        """
        Transitions a notification to READ or ARCHIVED.
        user_id is included in the WHERE clause as a secondary RLS safeguard.
        """
        from datetime import datetime, timezone

        update_payload = {"status": status}
        if status == "READ":
            update_payload["read_at"] = datetime.now(timezone.utc).isoformat()

        result = await (
            self._db
            .table("journey_notifications")
            .update(update_payload)
            .eq("id", notification_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise ValueError(
                f"Notification {notification_id} not found for user {user_id}."
            )
        return result.data[0]

    async def insert_notification(self, payload: dict) -> dict:
        """
        Creates a new notification record. Called by event handlers after PUBLISHED status.
        payload must include: user_id, category, severity, title, message.
        """
        result = await (
            self._db
            .table("journey_notifications")
            .insert(payload)
            .execute()
        )
        return result.data[0]

    # ------------------------------------------------------------------
    # journey_journal
    # ------------------------------------------------------------------

    async def get_journal_entries(
        self,
        user_id: str,
        limit: int = 30,
        offset: int = 0,
    ) -> list[dict]:
        """Paginated journal entries ordered newest-first."""
        result = await (
            self._db
            .table("journey_journal")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data or []

    async def insert_journal_entry(self, payload: dict) -> dict:
        """
        Appends an immutable journal entry. Called exclusively by event handlers.
        payload must include: user_id, message, severity.
        source_event_id should be set when the journal entry maps to a specific event.
        """
        result = await (
            self._db
            .table("journey_journal")
            .insert(payload)
            .execute()
        )
        return result.data[0]

    # ------------------------------------------------------------------
    # journey_unlock_events
    # ------------------------------------------------------------------

    async def get_pending_unlocks(self, user_id: str) -> list[dict]:
        """
        Returns all Level-Up feature unlocks not yet acknowledged by the client.
        Surfaced in the bootstrap payload until POST /unlocks/{id}/acknowledge is called.
        """
        result = await (
            self._db
            .table("journey_unlock_events")
            .select("*")
            .eq("user_id", user_id)
            .eq("shown", False)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []

    async def insert_unlock_event(
        self,
        user_id: str,
        level_reached: int,
        feature_key: str,
    ) -> dict:
        """
        Creates a new unlock record when a LEVEL_UP event is processed.
        Subsequent bootstrap calls will include this in pending_unlocks
        until the client acknowledges it.
        """
        payload = {
            "user_id": user_id,
            "level_reached": level_reached,
            "feature_key": feature_key,
            "shown": False,
            "claimed": False,
        }
        result = await (
            self._db
            .table("journey_unlock_events")
            .insert(payload)
            .execute()
        )
        logger.info(
            "Feature unlock created: user=%s level=%d feature=%s",
            user_id, level_reached, feature_key,
        )
        return result.data[0]

    async def mark_unlock_acknowledged(
        self,
        unlock_id: str,
        user_id: str,
    ) -> dict:
        """
        Marks an unlock as shown=True and claimed=True.
        user_id guard prevents cross-user acknowledgement.
        """
        result = await (
            self._db
            .table("journey_unlock_events")
            .update({"shown": True, "claimed": True})
            .eq("id", unlock_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not result.data:
            raise ValueError(
                f"Unlock event {unlock_id} not found for user {user_id}."
            )
        return result.data[0]

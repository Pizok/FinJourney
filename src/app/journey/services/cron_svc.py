"""
src/backend/journey/services/cron_svc.py

Background job processor for the Journey Engine's scheduled operations.

Managed by Upstash QStash, which sends signed HTTP webhooks to FastAPI.
The router receives the webhook, returns 202 immediately, and delegates
all heavy work to FastAPI BackgroundTasks — preventing QStash timeout
retries that would trigger duplicate penalty runs.

Two primary jobs:

  1. process_rolling_midnight(target_timezone, trigger_date)
       The "Rolling Midnight" master job. Fired hourly by QStash.
       Determines which IANA timezones are currently at 00:00 local time,
       queries all active users in those zones, and injects a
       MIDNIGHT_EVALUATION_STARTED event for each via EventBus.

       Idempotency: Each event carries a unique key
         "{user_id}:{YYYY-MM-DD}:midnight_eval"
       On QStash retry after a dropped 202 response, the EventBus catches
       the Supabase unique_violation on the idempotency_key and skips the
       handler silently — preventing double Ghost Penalties.

  2. run_daily_cleanup()
       The "Daily Janitor" job. Fired once per UTC day.
       Expires overdue Defense Shields (AVAILABLE → EXPIRED) and stale
       Standby Tokens (ACTIVE → USED) in bulk, then clears PREPARING
       challenges that stalled for more than 24 hours.

Cron schedule (journey_jobs_and_scheduler.md §2):
  Rolling midnight: `0 * * * *`  (every hour, 24×/day via QStash)
  Daily janitor:    `0 0 * * *`  (once per day at UTC midnight)

Batch rules (logic.md — Cron & Scheduler Architecture):
  - Never create one cron job per user.
  - Process users in chunks of 100–500.
  - Always use indexed timestamp filters.
  - All scheduled events must be idempotent.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import TYPE_CHECKING
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from supabase import AsyncClient

from ..repos.event_repo import EventRepository
from ..repos.profile_repo import ProfileRepository
from ..services.inventory_svc import InventoryService

if TYPE_CHECKING:
    from ..engine.bus import EventBus

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Batch Configuration
# ---------------------------------------------------------------------------

_BATCH_SIZE = 200           # Users processed per chunk (logic.md: 100–500)
_STALL_THRESHOLD_HOURS = 24  # PREPARING challenges older than this are cleared


# ---------------------------------------------------------------------------
# Result Types
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class MidnightEvalResult:
    """
    Outcome of a single process_rolling_midnight() invocation.

    Attributes:
        timezone_processed: The IANA timezone string that was evaluated.
        trigger_date:       The local date string that was evaluated "YYYY-MM-DD".
        users_found:        Total user IDs queried in this timezone.
        events_injected:    Events that were newly inserted (is_duplicate=False).
        events_skipped:     Events that were duplicate (is_duplicate=True) — cron retry.
        batches:            Number of batch chunks processed.
    """
    timezone_processed: str
    trigger_date: str
    users_found: int
    events_injected: int
    events_skipped: int
    batches: int


@dataclass
class CleanupResult:
    """
    Outcome of run_daily_cleanup().

    Attributes:
        shields_expired:          Defense Shields transitioned to EXPIRED.
        tokens_used:              Standby Tokens transitioned to USED.
        stalled_challenges_fixed: PREPARING challenges cleared.
    """
    shields_expired: int = 0
    tokens_used: int = 0
    stalled_challenges_fixed: int = 0
    advancements_synced: int = 0


@dataclass(frozen=True, slots=True)
class EveningReminderResult:
    """
    Outcome of a single send_evening_reminder_emails() invocation.

    Attributes:
        timezone_processed: IANA timezone string that was evaluated.
        trigger_date:       Local date string evaluated "YYYY-MM-DD".
        users_checked:      Total users queried in this timezone.
        emails_sent:        Reminder emails successfully dispatched.
        emails_skipped:     Users skipped because they already had activity today.
        emails_failed:      Users where the email send raised an exception.
    """
    timezone_processed: str
    trigger_date: str
    users_checked: int
    emails_sent: int
    emails_skipped: int
    emails_failed: int


# ---------------------------------------------------------------------------
# CronService
# ---------------------------------------------------------------------------


class CronService:
    """
    Orchestrates all scheduled background jobs for the Journey Engine.

    Instantiate once per cron webhook request via FastAPI dependency injection.
    All methods are designed to be called from FastAPI BackgroundTasks so
    the HTTP response (202 Accepted) is returned to QStash before processing begins.
    """

    def __init__(self, db: AsyncClient, bus: "EventBus") -> None:
        self._db = db
        self._bus = bus
        self._profile_repo = ProfileRepository(db)
        self._event_repo = EventRepository(db)

    # ------------------------------------------------------------------
    # Job 1 — Rolling Midnight Evaluator
    # ------------------------------------------------------------------

    async def process_rolling_midnight(
        self,
        target_timezone: str,
        trigger_date: str,
    ) -> MidnightEvalResult:
        """
        Processes the nightly evaluation for all users in a specific timezone.

        Called by the router's BackgroundTask after QStash fires the hourly
        webhook. This method handles one timezone per invocation. The router
        determines which timezone(s) are currently at 00:00 before dispatching.

        Pipeline:
          1. Validate the IANA timezone string.
          2. Query all active users in this timezone from journey_profiles.
          3. Process in batches of _BATCH_SIZE.
          4. For each user: inject MIDNIGHT_EVALUATION_STARTED via EventBus.
             (EventBus handles idempotency — duplicates are silently skipped.)
          5. Return a MidnightEvalResult for operational monitoring.

        Args:
            target_timezone: IANA timezone string, e.g. "Asia/Jakarta".
            trigger_date:    Local date being evaluated "YYYY-MM-DD".
                             This is the date that just ended at midnight.

        Returns:
            MidnightEvalResult with injection counts and batch stats.
        """
        logger.info(
            "CronService.process_rolling_midnight: START timezone=%s date=%s",
            target_timezone, trigger_date,
        )

        # ── 1. Validate timezone ──────────────────────────────────────────────
        try:
            ZoneInfo(target_timezone)
        except (ZoneInfoNotFoundError, KeyError):
            logger.error(
                "CronService.process_rolling_midnight: invalid timezone '%s' — aborting.",
                target_timezone,
            )
            return MidnightEvalResult(
                timezone_processed=target_timezone,
                trigger_date=trigger_date,
                users_found=0,
                events_injected=0,
                events_skipped=0,
                batches=0,
            )

        # ── 2. Query all active users in this timezone ────────────────────────
        all_user_ids: list[str] = await self._profile_repo.get_users_by_timezone(
            target_timezone
        )
        total_users = len(all_user_ids)

        if total_users == 0:
            logger.info(
                "CronService.process_rolling_midnight: no active users in timezone=%s — done.",
                target_timezone,
            )
            return MidnightEvalResult(
                timezone_processed=target_timezone,
                trigger_date=trigger_date,
                users_found=0,
                events_injected=0,
                events_skipped=0,
                batches=0,
            )

        logger.info(
            "CronService.process_rolling_midnight: %d users found in timezone=%s.",
            total_users, target_timezone,
        )

        # ── 3 & 4. Process in batches ─────────────────────────────────────────
        total_injected = 0
        total_skipped = 0
        batch_number = 0

        for batch_start in range(0, total_users, _BATCH_SIZE):
            batch = all_user_ids[batch_start : batch_start + _BATCH_SIZE]
            batch_number += 1

            results = await self._event_repo.bulk_insert_midnight_evaluation_events(
                user_ids=batch,
                local_date=trigger_date,
            )

            batch_injected = sum(1 for r in results.values() if not r.is_duplicate)
            batch_skipped = sum(1 for r in results.values() if r.is_duplicate)

            total_injected += batch_injected
            total_skipped += batch_skipped

            logger.debug(
                "CronService: batch %d/%d — injected=%d skipped=%d",
                batch_number,
                -(-total_users // _BATCH_SIZE),  # ceiling division
                batch_injected,
                batch_skipped,
            )

            # Dispatch injected events through the EventBus handler chain.
            # Duplicate events are not dispatched — EventBus already handles this.
            for user_id, result in results.items():
                if result.is_duplicate:
                    continue
                await self._dispatch_midnight_event(
                    user_id=user_id,
                    event_row=result.data,
                    trigger_date=trigger_date,
                )

        summary = MidnightEvalResult(
            timezone_processed=target_timezone,
            trigger_date=trigger_date,
            users_found=total_users,
            events_injected=total_injected,
            events_skipped=total_skipped,
            batches=batch_number,
        )

        logger.info(
            "CronService.process_rolling_midnight: DONE timezone=%s date=%s "
            "users=%d injected=%d skipped=%d batches=%d",
            target_timezone, trigger_date,
            summary.users_found, summary.events_injected,
            summary.events_skipped, summary.batches,
        )
        return summary

    async def _dispatch_midnight_event(
        self,
        user_id: str,
        event_row: dict,
        trigger_date: str,
    ) -> None:
        """
        Routes a newly inserted MIDNIGHT_EVALUATION_STARTED event to the handler.

        The event row is already in the DB (status=CREATED). We invoke the bus
        handler chain directly to advance it through PROCESSED → PUBLISHED.
        This triggers the full midnight evaluation: Ghost Penalty check,
        clean-day streak update, quarterly challenge evaluation, and region shift.

        Errors in individual user evaluations are caught and logged — one
        user's failure must never abort the batch for all other users.
        """
        try:
            # Re-publish through the bus to trigger the MIDNIGHT_EVALUATION_STARTED
            # handler chain. The idempotency key already exists, so EventBus will
            # detect the duplicate, fetch the existing row, and skip re-insertion.
            # We must call the handler directly via the loaded registry instead.
            handlers = self._bus._load_handlers()
            handler = handlers.get("MIDNIGHT_EVALUATION_STARTED")

            if handler is None:
                logger.error(
                    "CronService._dispatch_midnight_event: no handler registered "
                    "for MIDNIGHT_EVALUATION_STARTED — skipping user=%s.",
                    user_id,
                )
                return

            from ..events.bus import EventContext

            ctx = EventContext(
                event=event_row,
                bus=self._bus,
                db=self._db,
                user_id=user_id,
                payload=event_row.get("payload", {"local_date": trigger_date}),
            )

            await handler(ctx)

            # Advance event lifecycle to PROCESSED → PUBLISHED.
            await self._event_repo.update_event_status(event_row["id"], "PROCESSED")
            await self._event_repo.update_event_status(event_row["id"], "PUBLISHED")

        except Exception as exc:
            logger.exception(
                "CronService._dispatch_midnight_event: evaluation failed for user=%s "
                "date=%s — %s. Marking event FAILED.",
                user_id, trigger_date, exc,
            )
            await self._event_repo.update_event_status(
                event_row["id"],
                "FAILED",
                error_log=f"{type(exc).__name__}: {exc}",
            )

    # ------------------------------------------------------------------
    # Job 2 — Daily Janitor
    # ------------------------------------------------------------------

    async def run_daily_cleanup(self) -> CleanupResult:
        """
        Performs bulk maintenance across all users.
        Called once per UTC day by the `POST /cron/system-cleanup` webhook.

        Operations (journey_jobs_and_scheduler.md §3):
          1. Defense Shield expiry:
               AVAILABLE shields past `expires_at` → EXPIRED.
          2. Stale Active Token cleanup:
               ACTIVE standby tokens past `expires_at` → USED.
          3. Stalled PREPARING challenge cleanup:
               PREPARING challenges older than 24 hours → FAILED.
               (These indicate a system error in the cron chain.)
          4. Node Advancement Sync:
               Query all users with has_completed_setup=True and run
               evaluate_node_advancement as a safety net.

        Returns:
            CleanupResult with counts for each operation.
        """
        logger.info("CronService.run_daily_cleanup: START")
        result = CleanupResult()

        # ── 1. Expire overdue shields and stale tokens ────────────────────────
        inv_svc = InventoryService(self._db, self._bus)
        expiry_counts = await inv_svc.expire_overdue_items()
        result.shields_expired = expiry_counts["shields_expired"]
        result.tokens_used = expiry_counts["tokens_used"]

        # ── 2. Clear stalled PREPARING challenges ─────────────────────────────
        stalled = await self._profile_repo.get_stalled_preparing_challenges(
            stalled_threshold_hours=_STALL_THRESHOLD_HOURS
        )
        for challenge in stalled:
            challenge_id = challenge.get("id", "")
            if challenge_id:
                try:
                    await self._profile_repo.update_challenge_status(
                        challenge_id, "FAILED"
                    )
                    result.stalled_challenges_fixed += 1
                    logger.warning(
                        "CronService.run_daily_cleanup: stalled PREPARING challenge "
                        "set to FAILED — id=%s user=%s",
                        challenge_id, challenge.get("user_id"),
                    )
                except Exception as exc:
                    logger.error(
                        "CronService.run_daily_cleanup: failed to clear stalled "
                        "challenge %s — %s",
                        challenge_id, exc,
                    )

        # ── 3. Node Advancement Sync ──────────────────────────────────────────
        from app.journey.services.advancement_svc import evaluate_node_advancement
        
        # Query active users
        active_users_res = await self._db.table("journey_profiles").select("id").eq("has_completed_setup", True).execute()
        active_users = active_users_res.data if active_users_res.data else []
        
        for user_row in active_users:
            user_id = user_row.get("id")
            if user_id:
                try:
                    await evaluate_node_advancement(self._db, user_id)
                    result.advancements_synced += 1
                except Exception as exc:
                    logger.error("CronService.run_daily_cleanup: advancement sync failed for %s — %s", user_id, exc)

        logger.info(
            "CronService.run_daily_cleanup: DONE shields_expired=%d "
            "tokens_used=%d stalled_challenges=%d advancements_synced=%d",
            result.shields_expired, result.tokens_used, result.stalled_challenges_fixed, result.advancements_synced
        )
        return result

    # ------------------------------------------------------------------
    # Job 3 -- Evening Reminder
    # ------------------------------------------------------------------

    async def send_evening_reminder_emails(
        self,
        target_timezone: str,
        trigger_date: str,
    ) -> EveningReminderResult:
        """
        Sends the daily 20:00 reminder email to eligible users.

        Called by the router's BackgroundTask after QStash fires the hourly
        webhook (0 * * * *). This method handles one timezone per invocation.
        The router determines which timezone(s) are currently at 20:00 local.

        Eligibility criteria:
          - User has daily_reminder = True in notification_settings.
          - User's journey_daily_survival status is PENDING for trigger_date
            (no expense, income, or zero-spend claimed today).

        Args:
            target_timezone: IANA timezone string, e.g. "Asia/Jakarta".
            trigger_date:    Local date being evaluated "YYYY-MM-DD".

        Returns:
            EveningReminderResult with send/skip/fail counts.
        """
        logger.info(
            "CronService.send_evening_reminder_emails: START timezone=%s date=%s",
            target_timezone, trigger_date,
        )

        try:
            ZoneInfo(target_timezone)
        except (ZoneInfoNotFoundError, KeyError):
            logger.error(
                "CronService.send_evening_reminder_emails: invalid timezone '%s' -- aborting.",
                target_timezone,
            )
            return EveningReminderResult(
                timezone_processed=target_timezone,
                trigger_date=trigger_date,
                users_checked=0,
                emails_sent=0,
                emails_skipped=0,
                emails_failed=0,
            )

        # -- 1. Query users with daily_reminder = True in this timezone ---------
        # Supabase JSON path filter: notification_settings->>'daily_reminder' = 'true'
        try:
            raw = await (
                self._db.table("journey_profiles")
                .select("id, projected_safe_daily_budget, current_streak, notification_settings")
                .eq("timezone", target_timezone)
                .eq("has_completed_setup", True)
                .execute()
            )
            all_users = raw.data or []
        except Exception as exc:
            logger.error(
                "CronService.send_evening_reminder_emails: query failed timezone=%s -- %s",
                target_timezone, exc,
            )
            return EveningReminderResult(
                timezone_processed=target_timezone,
                trigger_date=trigger_date,
                users_checked=0,
                emails_sent=0,
                emails_skipped=0,
                emails_failed=0,
            )

        # Filter in Python: keep only users with daily_reminder enabled
        reminder_users = [
            u for u in all_users
            if (u.get("notification_settings") or {}).get("daily_reminder", True)
        ]

        total = len(reminder_users)
        sent = skipped = failed = 0

        from app.services.user_lookup_svc import get_user_email, get_user_display_name
        from app.services.email_svc import send_daily_reminder

        # -- 2. Process in batches of _BATCH_SIZE ----------------------------
        for batch_start in range(0, max(1, total), _BATCH_SIZE):
            batch = reminder_users[batch_start: batch_start + _BATCH_SIZE]
            for user_row in batch:
                user_id: str = user_row.get("id", "")
                if not user_id:
                    continue

                # -- 3. Eligibility: check survival status --------------------
                try:
                    survival_raw = await (
                        self._db.table("journey_daily_survival")
                        .select("status")
                        .eq("user_id", user_id)
                        .eq("tracking_date", trigger_date)
                        .maybe_single()
                        .execute()
                    )
                    survival_status = (
                        survival_raw.data.get("status") if survival_raw.data else "PENDING"
                    )
                    if survival_status != "PENDING":
                        skipped += 1
                        continue
                except Exception as exc:
                    logger.debug(
                        "CronService.send_evening_reminder_emails: survival check failed "
                        "user=%s -- %s. Treating as PENDING.",
                        user_id, exc,
                    )

                # -- 4. Fetch email + display name ----------------------------
                try:
                    email = await get_user_email(self._db, user_id)
                    if not email:
                        skipped += 1
                        continue

                    name = await get_user_display_name(self._db, user_id)
                    daily_budget = int(user_row.get("projected_safe_daily_budget") or 0)
                    streak = int(user_row.get("current_streak") or 0)

                    # -- 5. Send -------------------------------------------------
                    await send_daily_reminder(
                        to=email,
                        username=name,
                        daily_budget=daily_budget,
                        streak=streak,
                    )
                    sent += 1
                except Exception as exc:
                    failed += 1
                    logger.warning(
                        "CronService.send_evening_reminder_emails: send failed user=%s -- %s",
                        user_id, exc,
                    )

        result = EveningReminderResult(
            timezone_processed=target_timezone,
            trigger_date=trigger_date,
            users_checked=total,
            emails_sent=sent,
            emails_skipped=skipped,
            emails_failed=failed,
        )
        logger.info(
            "CronService.send_evening_reminder_emails: DONE timezone=%s "
            "checked=%d sent=%d skipped=%d failed=%d",
            target_timezone, total, sent, skipped, failed,
        )
        return result

    # ------------------------------------------------------------------
    # Timezone Utility -- Determine Current Midnight Timezones
    # ------------------------------------------------------------------

    @staticmethod
    def get_timezones_at_midnight_now() -> list[tuple[str, str]]:
        """
        Returns a list of (iana_timezone, local_date) tuples for all IANA
        timezones where the current UTC time corresponds to local midnight
        (00:00:00 to 00:59:59 local time).

        Called by the router before dispatching process_rolling_midnight()
        to determine which timezone(s) to process this hour.

        The router passes target_timezone and trigger_date as the local date
        that just ended (the date whose activity is being evaluated).

        Implementation note:
          We check a representative sample of timezone offsets rather than
          iterating all ~600 IANA zones. In production, query the distinct
          timezones actually in use from journey_profiles instead.
          See: `SELECT DISTINCT timezone FROM journey_profiles`.
        """
        # Common timezones used by FinJourney's target demographic (SE Asia + global).
        # Production: replace with a DB query of `SELECT DISTINCT timezone FROM journey_profiles`.
        _SUPPORTED_TIMEZONES = [
            "Asia/Jakarta",      # UTC+7  -- Indonesia (primary market)
            "Asia/Makassar",     # UTC+8  -- Indonesia East
            "Asia/Jayapura",     # UTC+9  -- Indonesia Far East
            "Asia/Singapore",    # UTC+8
            "Asia/Kuala_Lumpur", # UTC+8
            "Asia/Bangkok",      # UTC+7
            "Asia/Manila",       # UTC+8
            "Asia/Tokyo",        # UTC+9
            "Asia/Seoul",        # UTC+9
            "Asia/Kolkata",      # UTC+5:30
            "Asia/Dubai",        # UTC+4
            "Europe/London",     # UTC+0 / UTC+1 DST
            "Europe/Paris",      # UTC+1 / UTC+2 DST
            "America/New_York",  # UTC-5 / UTC-4 DST
            "America/Chicago",   # UTC-6 / UTC-5 DST
            "America/Denver",    # UTC-7 / UTC-6 DST
            "America/Los_Angeles", # UTC-8 / UTC-7 DST
            "America/Sao_Paulo", # UTC-3
            "Australia/Sydney",  # UTC+10 / UTC+11 DST
            "UTC",
        ]

        now_utc = datetime.now(timezone.utc)
        result: list[tuple[str, str]] = []

        for tz_name in _SUPPORTED_TIMEZONES:
            try:
                tz = ZoneInfo(tz_name)
                local_now = now_utc.astimezone(tz)

                # Midnight window: 00:00:00 to 00:59:59 local time.
                if local_now.hour == 0:
                    # The date being evaluated is "yesterday" local time --
                    # the day that just ended at this midnight.
                    evaluated_date = (local_now.date() - timedelta(days=1)).isoformat()
                    result.append((tz_name, evaluated_date))

            except (ZoneInfoNotFoundError, KeyError, Exception) as exc:
                logger.warning(
                    "get_timezones_at_midnight_now: error checking timezone=%s -- %s",
                    tz_name, exc,
                )

        return result

    @staticmethod
    def get_timezones_at_evening_now() -> list[tuple[str, str]]:
        """
        Returns a list of (iana_timezone, local_date) tuples for all IANA
        timezones where the current UTC time corresponds to 20:00 local time
        (20:00:00 to 20:59:59 local time).

        Called by the router before dispatching send_evening_reminder_emails()
        to determine which timezone(s) should receive reminder emails now.

        Uses the same supported timezone list as get_timezones_at_midnight_now().
        trigger_date is today's local date (the active day, not yesterday).
        """
        _SUPPORTED_TIMEZONES = [
            "Asia/Jakarta",
            "Asia/Makassar",
            "Asia/Jayapura",
            "Asia/Singapore",
            "Asia/Kuala_Lumpur",
            "Asia/Bangkok",
            "Asia/Manila",
            "Asia/Tokyo",
            "Asia/Seoul",
            "Asia/Kolkata",
            "Asia/Dubai",
            "Europe/London",
            "Europe/Paris",
            "America/New_York",
            "America/Chicago",
            "America/Denver",
            "America/Los_Angeles",
            "America/Sao_Paulo",
            "Australia/Sydney",
            "UTC",
        ]

        now_utc = datetime.now(timezone.utc)
        result: list[tuple[str, str]] = []

        for tz_name in _SUPPORTED_TIMEZONES:
            try:
                tz = ZoneInfo(tz_name)
                local_now = now_utc.astimezone(tz)

                # Evening window: 20:00:00 to 20:59:59 local time.
                if local_now.hour == 20:
                    # trigger_date is today's date -- the active day being evaluated.
                    result.append((tz_name, local_now.date().isoformat()))

            except (ZoneInfoNotFoundError, KeyError, Exception) as exc:
                logger.warning(
                    "get_timezones_at_evening_now: error checking timezone=%s -- %s",
                    tz_name, exc,
                )

        return result

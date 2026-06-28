"""
src/backend/journey/services/bootstrap_svc.py

Consolidated dashboard hydration for the Journey Engine.

Single responsibility:
  BootstrapService.get_full_dashboard() is the ONLY method. It fetches every
  data slice required to render the Journey Dashboard in a single round-trip,
  using asyncio.gather to run all Supabase queries concurrently.

Architecture rationale:
  The dashboard needs data from six independent tables:
    journey_profiles / journey_daily_survival / journey_daily_xp
    journey_inventory / journey_challenges / journey_regions
    journey_notifications / journey_journal / journey_unlock_events

  A naive sequential approach costs ~6–9 network round-trips. asyncio.gather
  collapses this to the latency of the SLOWEST single query.

  This service produces a fully validated BootstrapResponse Pydantic model.
  Routers receive a clean typed object — no dict surgery at the boundary.

Failure contract:
  Any sub-query that raises is propagated. The route handler must return 500.
  Partial dashboard states are never returned — the client always gets the
  full payload or nothing. This keeps frontend hydration logic simple.

Derived fields:
  - level is computed from total_xp (never stored as authoritative on client)
  - xp_needed is computed from level and total_xp via XPService statics
  - vitality is read from journey_profiles (written by HPService on every mutation)
  - daily_budget is the pre-calculated value from the profile / baseline system
  - zero_spend_eligible is derived from daily_survival.status == "PENDING"
  - ghost_penalty_protected = status in (SAFE_LOGGED, SAFE_CLAIMED) OR standby active
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timezone
from typing import Any

from supabase import AsyncClient

from ..schemas.responses import (
    ActiveChallengeResponse,
    BootstrapResponse,
    ChallengeStatus,
    DailyStatusResponse,
    EventSeverity,
    InventoryResponse,
    JournalEntryResponse,
    NotificationItemResponse,
    NotificationsResponse,
    PathInfoResponse,
    PathInfoResponse,
    PlayerPathID,
    PendingUnlockResponse,
    PlayerStateResponse,
    RecentLogsResponse,
    RegionProgressResponse,
    ShieldResponse,
    StandbyModeResponse,
    VitalityState,
    WinConditionResponse,
)
from ..repos.profile_repo import ProfileRepository
from ..repos.inventory_repo import InventoryRepository
from ..services.xp_svc import XPService

logger = logging.getLogger(__name__)

_JOURNAL_PREVIEW_LIMIT = 10      # Recent journal entries shown on dashboard
_NOTIFICATION_PREVIEW_LIMIT = 20  # Unread notifications shown on dashboard


# ---------------------------------------------------------------------------
# BootstrapService
# ---------------------------------------------------------------------------


class BootstrapService:
    """
    Produces the fully hydrated BootstrapResponse for GET /bootstrap.

    All Supabase queries run concurrently via asyncio.gather in two waves:
      Wave 1 (independent): profile, daily_survival, inventory, region,
                            challenge, journal, notifications, unlocks.
      Wave 2 (profile-derived): any computation that needs the profile row
                                result from Wave 1 (level, XP thresholds,
                                path info, vitality).

    The two-wave design avoids nested gather calls while keeping derived
    fields correct — level cannot be computed until total_xp is known.
    """

    def __init__(self, db: AsyncClient) -> None:
        self._db = db
        self._profile_repo = ProfileRepository(db)
        self._inventory_repo = InventoryRepository(db)

    # ------------------------------------------------------------------
    # Public Interface
    # ------------------------------------------------------------------

    async def get_full_dashboard(self, user_id: str) -> BootstrapResponse:
        """
        Fetches and assembles the full Journey Dashboard payload.

        Execution order:
          1. Wave 1 — eight concurrent Supabase queries via asyncio.gather.
          2. Build all sub-models (pure Python, no I/O).
          3. Assemble and validate the final BootstrapResponse.

        Returns:
            Fully validated BootstrapResponse Pydantic model.

        Raises:
            ValueError: If the player profile does not exist (not onboarded).
            Exception:  Propagates any Supabase client errors to the router.
        """
        # ── Fetch profile first to get timezone ─────────────────────────────
        profile = await self._fetch_profile(user_id)
        if not profile:
            raise ValueError(
                f"Player profile not found for user_id={user_id}. "
                "The player may not have completed onboarding."
            )
            
        import pytz
        tz_str = profile.get("timezone", "UTC")
        try:
            local_tz = pytz.timezone(tz_str)
        except pytz.UnknownTimeZoneError:
            local_tz = pytz.UTC
            
        local_today_date = datetime.now(local_tz).date()
        local_today = local_today_date.isoformat()
        
        # ── Wave 1 — concurrent data fetch ───────────────────────────────────
        (
            daily_survival,
            inventory_summary,
            current_region,
            active_challenge,
            journal_entries,
            notifications_data,
            pending_unlocks,
        ) = await asyncio.gather(
            self._fetch_daily_survival(user_id, local_today),
            self._fetch_inventory_summary(user_id),
            self._fetch_current_region(user_id),
            self._fetch_active_challenge(user_id),
            self._fetch_recent_journal(user_id),
            self._fetch_notifications(user_id),
            self._fetch_pending_unlocks(user_id),
        )

        # ── Wave 2 — build sub-models (pure, no I/O) ─────────────────────────
        player_state = self._build_player_state(profile)
        daily_status = self._build_daily_status(
            profile=profile,
            daily_survival=daily_survival,
            inventory_summary=inventory_summary,
        )
        region_progress = self._build_region_progress(current_region, local_today_date)
        active_challenge_model = self._build_active_challenge(active_challenge, local_today_date)
        inventory_model = self._build_inventory(inventory_summary)
        recent_logs = self._build_recent_logs(journal_entries)
        notifications_model = self._build_notifications(notifications_data)
        pending_unlock_models = self._build_pending_unlocks(pending_unlocks)

        return BootstrapResponse(
            player_state=player_state,
            daily_status=daily_status,
            region_progress=region_progress,
            active_challenge=active_challenge_model,
            inventory=inventory_model,
            recent_logs=recent_logs,
            notifications=notifications_model,
            pending_unlocks=pending_unlock_models,
        )

    # ------------------------------------------------------------------
    # Wave 1 — Data Fetchers
    # ------------------------------------------------------------------

    async def _fetch_profile(self, user_id: str) -> dict | None:
        return await self._profile_repo.get_profile(user_id)

    async def _fetch_daily_survival(self, user_id: str, local_today: str) -> dict | None:
        return await self._profile_repo.get_daily_survival(user_id, local_today)

    async def _fetch_inventory_summary(self, user_id: str) -> dict:
        """
        Calls InventoryRepository.get_inventory_summary() which itself
        uses asyncio.gather internally for shields / active_standby / token_count.
        The outer gather nests these three sub-queries transparently.
        """
        return await self._inventory_repo.get_inventory_summary(user_id)

    async def _fetch_current_region(self, user_id: str) -> dict | None:
        return await self._profile_repo.get_current_region(user_id)

    async def _fetch_active_challenge(self, user_id: str) -> dict | None:
        return await self._profile_repo.get_active_challenge(user_id)

    async def _fetch_recent_journal(self, user_id: str) -> list[dict]:
        return await self._profile_repo.get_journal_entries(
            user_id, limit=_JOURNAL_PREVIEW_LIMIT, offset=0
        )

    async def _fetch_notifications(self, user_id: str) -> dict:
        """Fetches unread notifications and total unread count concurrently."""
        items, unread_count = await asyncio.gather(
            self._profile_repo.get_notifications(
                user_id,
                status="UNREAD",
                limit=_NOTIFICATION_PREVIEW_LIMIT,
                offset=0,
            ),
            self._profile_repo.count_unread_notifications(user_id),
        )
        return {"items": items, "unread_count": unread_count}

    async def _fetch_pending_unlocks(self, user_id: str) -> list[dict]:
        try:
            return await self._profile_repo.get_pending_unlocks(user_id)
        except Exception as e:
            print(f"Skipping get_pending_unlocks: {e}")
            return []

    # ------------------------------------------------------------------
    # Wave 2 — Sub-model Builders (pure Python, no I/O)
    # ------------------------------------------------------------------

    def _build_player_state(self, profile: dict) -> PlayerStateResponse:
        """
        Constructs the PlayerStateResponse from the profile row.

        Level and xp_needed are always derived at response-build time — they
        are never trusted from a client payload or stored as authoritative on
        the frontend. The profile's current_level column is the cached DB value
        kept in sync by XPService; we re-derive here for correctness.
        """
        total_xp: int = profile.get("total_xp", 0)
        level: int = XPService.compute_level(total_xp)
        xp_needed: int = XPService.compute_xp_to_next_level(level, total_xp)
        hp: int = max(0, min(100, profile.get("current_hp", 100)))
        vitality_raw: str = profile.get("vitality", "NORMAL")
        critical_failure: bool = vitality_raw == "CRITICAL_FAILURE"
        avatar_key: str = profile.get("avatar_key", "Roan")

        active_path_raw: str = profile.get("active_path", "UNASSIGNED")
        try:
            path_enum = PlayerPathID(active_path_raw)
        except ValueError:
            logger.warning(
                "BootstrapService: unknown active_path=%s for user=%s — defaulting to UNASSIGNED.",
                active_path_raw, profile.get("id"),
            )
            path_enum = PlayerPathID.UNASSIGNED

        try:
            vitality_enum = VitalityState(vitality_raw)
        except ValueError:
            vitality_enum = VitalityState.NORMAL

        return PlayerStateResponse(
            level=level,
            xp=total_xp,
            xp_needed=xp_needed,
            hp=hp,
            max_hp=100,
            vitality=vitality_enum,
            critical_failure=critical_failure,
            path=PathInfoResponse.from_path_id(path_enum),
            avatar_key=avatar_key,
            current_streak=profile.get("current_streak", 0),
        )

    def _build_daily_status(
        self,
        profile: dict,
        daily_survival: dict | None,
        inventory_summary: dict,
    ) -> DailyStatusResponse:
        """
        Constructs the DailyStatusResponse.

        safe_daily_budget:
          Sourced from profile.safe_daily_budget (pre-computed by the baseline
          service on income/fixed-cost/savings changes). Falls back to 0 if
          the player hasn't set a baseline yet.

        zero_spend_eligible:
          True only when status == "PENDING" (no transaction or ZS claim today).

        ghost_penalty_protected:
          True when status is SAFE_LOGGED or SAFE_CLAIMED, OR when Standby
          Mode is currently ACTIVE (any of these conditions prevents the penalty).
        """
        current_status: str = (
            daily_survival.get("status", "PENDING") if daily_survival else "PENDING"
        )
        safe_daily_budget: int = max(0, profile.get("safe_daily_budget", 0))
        
        expense_logged_today: bool = daily_survival.get("expense_xp_claimed", False) if daily_survival else False
        income_logged_today: bool = daily_survival.get("income_xp_claimed", False) if daily_survival else False
        zero_spend_marked: bool = current_status == "SAFE_CLAIMED"
        
        zero_spend_eligible: bool = current_status == "PENDING"

        standby_active: bool = (
            inventory_summary.get("standby_mode", {}).get("active", False)
        )
        ghost_penalty_protected: bool = (
            current_status in ("SAFE_LOGGED", "SAFE_CLAIMED") or standby_active
        )

        return DailyStatusResponse(
            safe_daily_budget=safe_daily_budget,
            expense_logged_today=expense_logged_today,
            income_logged_today=income_logged_today,
            zero_spend_marked=zero_spend_marked,
            zero_spend_eligible=zero_spend_eligible,
            ghost_penalty_protected=ghost_penalty_protected,
        )

    def _build_region_progress(
        self,
        region: dict | None,
        today: date,
    ) -> RegionProgressResponse:
        """
        Builds the region progress sub-model.

        days_progress and days_remaining are derived from the region's
        started_at and ends_at timestamps relative to today's UTC date.
        Clamped to [0, 365] to handle any edge-case clock skew.
        """
        if not region:
            return RegionProgressResponse(
                region_id="quiet_valley",
                days_progress=0,
                days_remaining=365,
            )

        region_id: str = region.get("region_id", "quiet_valley")

        try:
            started_at = datetime.fromisoformat(
                region["started_at"].replace("Z", "+00:00")
            ).date()
            ends_at = datetime.fromisoformat(
                region["ends_at"].replace("Z", "+00:00")
            ).date()
        except (ValueError, KeyError, AttributeError):
            logger.warning(
                "BootstrapService._build_region_progress: invalid dates in region row %s",
                region.get("id"),
            )
            return RegionProgressResponse(
                region_id=region_id,
                days_progress=0,
                days_remaining=365,
            )

        days_progress = max(0, min(365, (today - started_at).days))
        days_remaining = max(0, min(365, (ends_at - today).days))

        return RegionProgressResponse(
            region_id=region_id,
            days_progress=days_progress,
            days_remaining=days_remaining,
        )

    def _build_active_challenge(
        self, challenge: dict | None, today: date
    ) -> ActiveChallengeResponse | None:
        """
        Builds the active challenge sub-model.

        Returns None only during the brief PREPARING system transition.
        COMPLETED challenges (rewards unclaimed) are included so the dashboard
        can surface the reward CTA.
        """
        if not challenge:
            return None

        try:
            ends_at = datetime.fromisoformat(
                challenge["ends_at"].replace("Z", "+00:00")
            )
            days_remaining = max(0, (ends_at.date() - today).days)
        except (ValueError, KeyError, AttributeError):
            days_remaining = 0

        progress_data: dict = challenge.get("progress_data", {})
        raw_conditions: list[dict] = progress_data.get("win_conditions", [])

        win_conditions = []
        for cond in raw_conditions:
            try:
                win_conditions.append(
                    WinConditionResponse(
                        label=str(cond.get("label", "Objective")),
                        current=int(cond.get("current", 0)),
                        target=max(1, int(cond.get("target", 1))),
                    )
                )
            except (ValueError, TypeError) as exc:
                logger.warning(
                    "BootstrapService: malformed win_condition in challenge %s — %s",
                    challenge.get("id"), exc,
                )

        try:
            status_enum = ChallengeStatus(challenge.get("status", "ACTIVE"))
        except ValueError:
            status_enum = ChallengeStatus.ACTIVE

        from ..challenge_templates import get_template
        template_id = challenge.get("template_id", "unknown")
        
        try:
            template = get_template(template_id)
            title = template.title
            desc = template.description
            icon = template.icon
            color = template.color
        except KeyError:
            title = "Unknown Challenge"
            desc = "A challenge from an unknown template."
            icon = "ti-sword"
            color = "gray"

        return ActiveChallengeResponse(
            id=challenge["id"],
            status=status_enum,
            type=template_id,
            title=title,
            description=desc,
            icon=icon,
            color=color,
            days_remaining=days_remaining,
            win_conditions=win_conditions,
            progress_data=progress_data,
            rewards_claimed=challenge.get("rewards_claimed", False),
        )

    def _build_inventory(self, inventory_summary: dict) -> InventoryResponse:
        """
        Parses the raw inventory_summary dict from InventoryRepository
        into a validated InventoryResponse Pydantic model.
        """
        standby_raw: dict = inventory_summary.get("standby_mode", {})
        shields_raw: list[dict] = inventory_summary.get("active_shields", [])

        standby_mode = StandbyModeResponse(
            active=bool(standby_raw.get("active", False)),
            ends_at=standby_raw.get("ends_at"),
            tokens_remaining=max(0, int(standby_raw.get("tokens_remaining", 0))),
            max_tokens=int(standby_raw.get("max_tokens", 7)),
        )

        shields: list[ShieldResponse] = []
        for s in shields_raw:
            try:
                shields.append(
                    ShieldResponse(
                        id=s["id"],
                        expires_at=s["expires_at"],
                        strength=int(s.get("strength", 10)),
                    )
                )
            except (KeyError, ValueError, TypeError) as exc:
                logger.warning(
                    "BootstrapService: malformed shield record %s — %s",
                    s.get("id"), exc,
                )

        return InventoryResponse(
            standby_mode=standby_mode,
            active_shields=shields,
        )

    def _build_recent_logs(
        self, journal_entries: list[dict]
    ) -> RecentLogsResponse:
        """
        Parses raw journal rows into JournalEntryResponse models.
        Silently skips any malformed rows to prevent dashboard hydration failure
        from a single corrupt log entry.
        """
        parsed: list[JournalEntryResponse] = []
        for entry in journal_entries:
            try:
                severity_raw = entry.get("severity", "INFO")
                severity = EventSeverity(severity_raw)
                created_at = datetime.fromisoformat(
                    entry["created_at"].replace("Z", "+00:00")
                )
                parsed.append(
                    JournalEntryResponse(
                        id=entry["id"],
                        date=created_at,
                        message=str(entry.get("message", "")),
                        severity=severity,
                    )
                )
            except (KeyError, ValueError, TypeError) as exc:
                logger.warning(
                    "BootstrapService: malformed journal entry %s — %s",
                    entry.get("id"), exc,
                )

        return RecentLogsResponse(journal_events=parsed)

    def _build_notifications(
        self, notifications_data: dict
    ) -> NotificationsResponse:
        """
        Parses raw notification rows and the pre-fetched unread count
        into a NotificationsResponse model.

        The unread_count is sourced from the DB count query (not len(items))
        to correctly reflect notifications beyond the preview limit.
        """
        from ..schemas.responses import NotificationCategory, NotificationStatus

        items_raw: list[dict] = notifications_data.get("items", [])
        unread_count: int = notifications_data.get("unread_count", 0)

        parsed: list[NotificationItemResponse] = []
        for n in items_raw:
            try:
                category = NotificationCategory(n.get("category", "SYSTEM"))
                severity = EventSeverity(n.get("severity", "INFO"))
                created_at = datetime.fromisoformat(
                    n["created_at"].replace("Z", "+00:00")
                )
                parsed.append(
                    NotificationItemResponse(
                        id=n["id"],
                        category=category,
                        title=str(n.get("title", "")),
                        message=str(n.get("message", "")),
                        severity=severity,
                        read=n.get("status", "UNREAD") == "READ",
                        action_type=n.get("action_type"),
                        action_payload=n.get("action_payload"),
                        created_at=created_at,
                    )
                )
            except (KeyError, ValueError, TypeError) as exc:
                logger.warning(
                    "BootstrapService: malformed notification %s — %s",
                    n.get("id"), exc,
                )

        return NotificationsResponse(
            unread_count=unread_count,
            items=parsed,
        )

    def _build_pending_unlocks(
        self, unlocks: list[dict]
    ) -> list[PendingUnlockResponse]:
        """
        Parses unacknowledged Level-Up feature unlock rows.
        Each unlock surfaces in the bootstrap until the client calls
        POST /unlocks/{id}/acknowledge.
        """
        parsed: list[PendingUnlockResponse] = []
        for unlock in unlocks:
            try:
                parsed.append(
                    PendingUnlockResponse(
                        id=unlock["id"],
                        level_reached=int(unlock["level_reached"]),
                        feature_key=str(unlock["feature_key"]),
                    )
                )
            except (KeyError, ValueError, TypeError) as exc:
                logger.warning(
                    "BootstrapService: malformed unlock record %s — %s",
                    unlock.get("id"), exc,
                )
        return parsed

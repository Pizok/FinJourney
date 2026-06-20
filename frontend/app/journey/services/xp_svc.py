"""
src/backend/journey/services/xp_svc.py

Manages all positive progression mechanics for the Journey Engine.

Responsibilities:
  - Daily XP cap enforcement via journey_daily_xp (anti-spam, game_rules.md §3)
  - Path-specific XP multipliers (CATALYST +income, PHANTOM +zero-spend)
  - Atomic XP delta application and journey_profiles persistence
  - Level threshold detection using L = floor(sqrt(XP / 100)) + 1
  - LEVEL_UP event emission for each crossed threshold (handles multi-level jumps)
  - Raw (uncapped) delta application for system grants (region shift, rewards)
  - Zero-spend XP revocation when an expense cancels a same-day claim

Architecture note:
  This service is the authoritative XP engine. Handlers in events/handlers.py
  may call repos directly as a first-pass shortcut; production refactors should
  route all XP mutations through XPService.evaluate_xp_gain() and apply_raw_delta()
  to guarantee cap and level-up correctness.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import TYPE_CHECKING, Callable, Awaitable

from supabase import AsyncClient

from ..repos.event_repo import EventRepository
from ..repos.profile_repo import ProfileRepository

if TYPE_CHECKING:
    from ..engine.bus import EventBus

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pure Math — no I/O
# ---------------------------------------------------------------------------


def _level_from_xp(total_xp: int) -> int:
    """
    Canonical level formula (logic.md):
        L = floor(sqrt(XP / 100)) + 1
    Level 1 is the floor — XP of 0 still returns level 1.
    """
    return math.floor(math.sqrt(max(0, total_xp) / 100)) + 1


def _xp_threshold_for_level(level: int) -> int:
    """
    Total XP required to first enter `level`.
    Inverse of _level_from_xp: threshold = (L − 1)² × 100
    Level 1 threshold = 0, Level 2 = 100, Level 3 = 400, Level 4 = 900 …
    """
    return (max(1, level) - 1) ** 2 * 100


def _xp_to_next_level(current_level: int, current_xp: int) -> int:
    """XP still needed from current_xp to cross into current_level + 1."""
    return max(0, _xp_threshold_for_level(current_level + 1) - current_xp)


# ---------------------------------------------------------------------------
# XP Source Configuration
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _XPSourceConfig:
    """
    Describes how XP is evaluated for a particular source event type.

    Fields:
        cap_field:      Column name in journey_daily_xp to check/set the cap.
        base_xp:        Default XP grant before path multiplier is applied.
        path_overrides: Dict of {path_id → override_xp} for non-default grants.
    """
    cap_field: str
    base_xp: int
    path_overrides: dict[str, int] = field(default_factory=dict)


_XP_SOURCES: dict[str, _XPSourceConfig] = {
    "EXPENSE_LOGGED": _XPSourceConfig(
        cap_field="expense_xp_claimed",
        base_xp=5,
        path_overrides={},
    ),
    "INCOME_LOGGED": _XPSourceConfig(
        cap_field="income_xp_claimed",
        base_xp=5,
        path_overrides={"CATALYST": 10},
    ),
    "ZERO_SPEND_CLAIMED": _XPSourceConfig(
        cap_field="zero_spend_xp_claimed",
        base_xp=10,
        path_overrides={"PHANTOM": 15},
    ),
}

# Mapping from cap_field → ProfileRepository method that marks the cap as consumed.
# Avoids string-based getattr while keeping the configuration table-driven.
_CAP_MARK_METHODS: dict[str, str] = {
    "expense_xp_claimed": "mark_expense_xp_claimed",
    "income_xp_claimed": "mark_income_xp_claimed",
    "zero_spend_xp_claimed": "mark_zero_spend_xp_claimed",
}


# ---------------------------------------------------------------------------
# Result Types
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class XPGainResult:
    """
    Outcome of evaluate_xp_gain() — an action-triggered, cap-checked XP evaluation.

    Attributes:
        granted:         Actual XP credited (0 if daily cap already consumed).
        was_capped:      True when the cap was already hit before this call.
        new_total_xp:    Total XP after the grant.
        level_before:    Player level before this evaluation.
        level_after:     Player level after this evaluation.
        leveled_up:      True when level_after > level_before.
        xp_to_next:      XP still needed to reach the next level threshold.
    """
    granted: int
    was_capped: bool
    new_total_xp: int
    level_before: int
    level_after: int
    leveled_up: bool
    xp_to_next: int


@dataclass(frozen=True, slots=True)
class RawXPDeltaResult:
    """
    Outcome of apply_raw_delta() — an uncapped, system-initiated XP change.

    Attributes:
        applied:      Delta actually written (equals the input delta, clamped at 0 floor).
        new_total_xp: Total XP after the delta.
        level_before: Level before the delta.
        level_after:  Level after the delta (may equal level_before).
        leveled_up:   True when level_after > level_before.
    """
    applied: int
    new_total_xp: int
    level_before: int
    level_after: int
    leveled_up: bool


# ---------------------------------------------------------------------------
# XPService
# ---------------------------------------------------------------------------


class XPService:
    """
    Central authority for all XP changes in the Journey Engine.

    Instantiate once per request via FastAPI dependency injection:
        xp_svc = XPService(db=Depends(get_db), bus=Depends(get_event_bus))

    Design contract:
        - Every call that mutates XP also triggers a level-up check.
        - Level-up detection emits LEVEL_UP events for EACH crossed threshold,
          supporting multi-level jumps from large raw grants (e.g. +1000 XP).
        - Handlers should call this service rather than calling profile_repo
          directly to guarantee cap and level-up consistency.
    """

    def __init__(self, db: AsyncClient, bus: "EventBus") -> None:
        self._db = db
        self._bus = bus
        self._profile_repo = ProfileRepository(db)
        self._event_repo = EventRepository(db)

    # ------------------------------------------------------------------
    # Primary Interface — Daily-Capped XP Evaluation
    # ------------------------------------------------------------------

    async def evaluate_xp_gain(
        self,
        user_id: str,
        source_event_type: str,
        local_date: str,
    ) -> XPGainResult:
        """
        Evaluates and applies XP for a user action, enforcing daily caps
        and path-specific multipliers.

        Daily cap rules (journey_game_rules.md §3.1):
          EXPENSE_LOGGED:     +5 XP, capped once per calendar day.
          INCOME_LOGGED:      +5 XP (CATALYST path: +10), capped once per day.
          ZERO_SPEND_CLAIMED: +10 XP (PHANTOM path: +15), once per day.
                              Mutually exclusive with expense — revoked if an expense
                              is later logged the same day (see revoke_zero_spend_xp).

        Returns XPGainResult with granted=0 and was_capped=True if cap is already hit.
        Unknown source_event_type is logged and returns a zero-grant result.

        Args:
            user_id:           Player UUID.
            source_event_type: One of "EXPENSE_LOGGED", "INCOME_LOGGED",
                               "ZERO_SPEND_CLAIMED".
            local_date:        Player's local calendar date "YYYY-MM-DD".
        """
        config = _XP_SOURCES.get(source_event_type)
        if config is None:
            logger.warning(
                "XPService.evaluate_xp_gain: unrecognised source_event_type=%s "
                "for user=%s — returning zero-grant result.",
                source_event_type, user_id,
            )
            return await self._zero_grant_result(user_id, was_capped=False)

        today = date.fromisoformat(local_date)

        # ── 1. Ensure daily XP tracking row exists ────────────────────────────
        daily_xp = await self._profile_repo.ensure_daily_xp_record(user_id, today)

        # ── 2. Cap check ──────────────────────────────────────────────────────
        if daily_xp and daily_xp.get(config.cap_field, False):
            logger.debug(
                "XPService: daily cap hit — user=%s source=%s cap=%s",
                user_id, source_event_type, config.cap_field,
            )
            return await self._zero_grant_result(user_id, was_capped=True)

        # ── 3. Resolve effective XP (apply path multiplier) ───────────────────
        profile = await self._profile_repo.get_profile(user_id)
        if not profile:
            logger.error(
                "XPService.evaluate_xp_gain: profile missing for user=%s.", user_id
            )
            return await self._zero_grant_result(user_id, was_capped=False)

        active_path: str = profile.get("active_path", "UNASSIGNED")
        effective_xp: int = config.path_overrides.get(active_path, config.base_xp)

        # ── 4. Mark cap as consumed ───────────────────────────────────────────
        mark_method_name = _CAP_MARK_METHODS[config.cap_field]
        mark_method: Callable[..., Awaitable] = getattr(
            self._profile_repo, mark_method_name
        )
        await mark_method(user_id, today)

        # ── 5. Apply delta and propagate level-up ─────────────────────────────
        raw = await self._apply_delta(
            user_id=user_id,
            profile=profile,
            delta=effective_xp,
            source_event=source_event_type,
            local_date=local_date,
        )

        logger.info(
            "XPService.evaluate_xp_gain: user=%s source=%s path=%s "
            "granted=%d xp=%d→%d level=%d→%d",
            user_id, source_event_type, active_path,
            effective_xp, raw.new_total_xp - effective_xp, raw.new_total_xp,
            raw.level_before, raw.level_after,
        )

        return XPGainResult(
            granted=effective_xp,
            was_capped=False,
            new_total_xp=raw.new_total_xp,
            level_before=raw.level_before,
            level_after=raw.level_after,
            leveled_up=raw.leveled_up,
            xp_to_next=_xp_to_next_level(raw.level_after, raw.new_total_xp),
        )

    # ------------------------------------------------------------------
    # Raw Delta — System Grants (bypasses daily caps)
    # ------------------------------------------------------------------

    async def apply_raw_delta(
        self,
        user_id: str,
        delta: int,
        source_event: str,
        local_date: str,
    ) -> RawXPDeltaResult:
        """
        Applies an XP delta that bypasses all daily cap checks.

        Used for:
          - Region Shift completion (+1000 XP, game_rules.md §5.2)
          - Quarterly Challenge reward claims (+250 XP, §5.1)
          - Task completion grants
          - Administrative corrections
          - Zero-spend XP revocations (negative delta)

        Still triggers level-up detection and LEVEL_UP event emission.
        XP total is floored at 0 — negative deltas cannot go below zero.

        Args:
            user_id:      Player UUID.
            delta:        XP change. Positive for grants; negative for revocations.
            source_event: Identifier for logging and event payload tracing.
            local_date:   Player's local date "YYYY-MM-DD" for idempotency keys.
        """
        if delta == 0:
            profile = await self._profile_repo.get_profile(user_id)
            xp = profile.get("total_xp", 0) if profile else 0
            level = _level_from_xp(xp)
            return RawXPDeltaResult(
                applied=0, new_total_xp=xp,
                level_before=level, level_after=level, leveled_up=False,
            )

        profile = await self._profile_repo.get_profile(user_id)
        if not profile:
            logger.error(
                "XPService.apply_raw_delta: profile missing for user=%s.", user_id
            )
            return RawXPDeltaResult(
                applied=0, new_total_xp=0,
                level_before=1, level_after=1, leveled_up=False,
            )

        result = await self._apply_delta(
            user_id=user_id,
            profile=profile,
            delta=delta,
            source_event=source_event,
            local_date=local_date,
        )

        logger.info(
            "XPService.apply_raw_delta: user=%s delta=%+d source=%s "
            "xp=…→%d level=%d→%d",
            user_id, delta, source_event,
            result.new_total_xp, result.level_before, result.level_after,
        )
        return result

    # ------------------------------------------------------------------
    # Zero-Spend XP Revocation
    # ------------------------------------------------------------------

    async def revoke_zero_spend_xp(
        self,
        user_id: str,
        active_path: str,
        local_date: str,
    ) -> int:
        """
        Subtracts the Zero-Spend XP previously granted when an expense is logged
        on the same day as a ZERO_SPEND_CLAIMED event.

        This implements the SAFE_CLAIMED → SAFE_LOGGED revocation rule
        from journey_state_machine.md §4.

        Steps:
          1. Determine the XP amount that was originally granted (path-aware).
          2. Clear the zero_spend_xp_claimed flag in journey_daily_xp.
          3. Apply a negative raw delta to subtract the XP.

        Returns the positive integer amount revoked (useful for event payload).
        """
        config = _XP_SOURCES["ZERO_SPEND_CLAIMED"]
        revoke_amount = config.path_overrides.get(active_path, config.base_xp)

        today = date.fromisoformat(local_date)
        await self._profile_repo.revoke_zero_spend_xp(user_id, today)

        await self.apply_raw_delta(
            user_id=user_id,
            delta=-revoke_amount,
            source_event="ZERO_SPEND_XP_REVOKED",
            local_date=local_date,
        )

        logger.info(
            "XPService.revoke_zero_spend_xp: user=%s revoked=%d path=%s",
            user_id, revoke_amount, active_path,
        )
        return revoke_amount

    # ------------------------------------------------------------------
    # Level-Up Detection and Emission (public for direct service calls)
    # ------------------------------------------------------------------

    async def check_level_up(
        self,
        user_id: str,
        new_total_xp: int,
        old_level: int,
        local_date: str,
    ) -> int:
        """
        Runs the level formula against new_total_xp and emits LEVEL_UP events
        for every threshold crossed. Updates journey_profiles if level changed.

        Supports multi-level jumps: a +1000 XP region shift that crosses three
        level thresholds emits three sequential LEVEL_UP events.

        Returns the new level (equals old_level if no threshold was crossed).

        Args:
            user_id:       Player UUID.
            new_total_xp:  XP total AFTER the grant has been applied.
            old_level:     Level BEFORE the grant, for threshold comparison.
            local_date:    Player's local date "YYYY-MM-DD" for idempotency keys.
        """
        new_level = _level_from_xp(new_total_xp)
        if new_level <= old_level:
            return old_level

        # Write new level to profile.
        await self._profile_repo.update_xp_and_level(user_id, new_total_xp, new_level)

        # Emit one LEVEL_UP event per crossed threshold (handles multi-level jumps).
        for reached_level in range(old_level + 1, new_level + 1):
            idem_key = self._event_repo.build_idempotency_key(
                user_id, local_date, "level_up", suffix=str(reached_level)
            )
            await self._bus.emit(
                user_id=user_id,
                event_type="LEVEL_UP",
                source="ENGINE",
                severity="SUCCESS",
                idempotency_key=idem_key,
                payload={
                    "old_level": reached_level - 1,
                    "new_level": reached_level,
                    "total_xp": new_total_xp,
                },
            )

        logger.info(
            "XPService.check_level_up: user=%s level=%d→%d xp=%d",
            user_id, old_level, new_level, new_total_xp,
        )
        return new_level

    # ------------------------------------------------------------------
    # Pure Static Helpers (no I/O — safe for response builders)
    # ------------------------------------------------------------------

    @staticmethod
    def compute_level(total_xp: int) -> int:
        """Derives level from XP without any DB access."""
        return _level_from_xp(total_xp)

    @staticmethod
    def compute_xp_to_next_level(current_level: int, current_xp: int) -> int:
        """XP still required to cross into the next level."""
        return _xp_to_next_level(current_level, current_xp)

    @staticmethod
    def compute_xp_threshold(level: int) -> int:
        """Total XP that defines the entry point for `level`."""
        return _xp_threshold_for_level(level)

    # ------------------------------------------------------------------
    # Internal Core
    # ------------------------------------------------------------------

    async def _apply_delta(
        self,
        user_id: str,
        profile: dict,
        delta: int,
        source_event: str,
        local_date: str,
    ) -> RawXPDeltaResult:
        """
        Computes new_xp, writes it to the DB, then runs the level-up check.

        Two-phase write:
          - If level unchanged → write XP only (one DB call, old level preserved).
          - If level increased → check_level_up writes both XP and new level.

        This avoids a redundant write when no threshold is crossed.
        """
        old_xp: int = profile.get("total_xp", 0)
        old_level: int = profile.get("current_level", 1)
        new_xp: int = max(0, old_xp + delta)

        # check_level_up writes XP+level if the level changed.
        new_level = await self.check_level_up(user_id, new_xp, old_level, local_date)

        # If level did not change, check_level_up made no DB write — do it here.
        if new_level == old_level:
            await self._profile_repo.update_xp_and_level(user_id, new_xp, old_level)

        return RawXPDeltaResult(
            applied=delta,
            new_total_xp=new_xp,
            level_before=old_level,
            level_after=new_level,
            leveled_up=new_level > old_level,
        )

    async def _zero_grant_result(
        self, user_id: str, was_capped: bool
    ) -> XPGainResult:
        """Builds a zero-grant result from the current profile state. No mutations."""
        profile = await self._profile_repo.get_profile(user_id)
        xp = profile.get("total_xp", 0) if profile else 0
        level = _level_from_xp(xp)
        return XPGainResult(
            granted=0,
            was_capped=was_capped,
            new_total_xp=xp,
            level_before=level,
            level_after=level,
            leveled_up=False,
            xp_to_next=_xp_to_next_level(level, xp),
        )

"""
src/backend/journey/services/inventory_svc.py

Manages the lifecycle of all player inventory items for the Journey Engine.

Responsibilities:
  - Standby Token activation and 24-hour protection window management.
  - Defense Shield generation from 7-consecutive-clean-day streaks.
  - Shield cap enforcement: SENTINEL path → max 5, all others → max 3.
  - Annual token refill on Region Shift (game_rules.md §5.2).
  - Initial inventory provisioning for newly onboarded players.
  - Bulk expiry cleanup (called by Daily Janitor cron).

Game rules (journey_game_rules.md §4):
  §4.1 Standby Token Logic:
      - Activation sets expires_at = now + 24 hours.
      - Hard limit: 7 tokens per 365-day Region cycle.
      - Ghost Penalty is skipped if a token is ACTIVE at midnight.

  §4.2 Defense Shield Generation (Clean Code Reward):
      - Backend tracks consecutive_clean_days (days ≤ safe_daily_budget).
      - On the 7th consecutive clean day: generate 1 shield, expires_at = now + 14 days.
      - Reset consecutive_clean_days to 0 after generation.
      - SENTINEL path max capacity: 5 shields. All other paths: 3 shields.
      - Excess shields (at cap) are discarded — no accumulation past cap.
      - Shield consumption by OVERSPEND_DETECTED does NOT break the streak.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import TYPE_CHECKING

from supabase import AsyncClient

from ..repos.event_repo import EventRepository
from ..repos.inventory_repo import InventoryRepository
from ..repos.profile_repo import ProfileRepository

if TYPE_CHECKING:
    from ..engine.bus import EventBus

logger = logging.getLogger(__name__)

_CLEAN_DAY_SHIELD_THRESHOLD = 7   # Consecutive clean days required for a shield.
_ANNUAL_TOKEN_ALLOTMENT = 7       # Max standby tokens per 365-day region cycle.


# ---------------------------------------------------------------------------
# Result Types
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class StandbyActivationResult:
    """
    Outcome of consume_standby_token().

    Attributes:
        token:           The activated inventory row dict.
        tokens_remaining: AVAILABLE tokens remaining after activation.
        ends_at:          UTC timestamp when the 24-hour window closes.
    """
    token: dict
    tokens_remaining: int
    ends_at: str


@dataclass(frozen=True, slots=True)
class ShieldGenerationResult:
    """
    Outcome of check_and_maybe_generate_shield().

    Attributes:
        generated:       True when a shield was successfully created.
        shield:          The new inventory row dict, or None if not generated.
        reason_skipped:  Human-readable reason if generated=False.
        current_count:   Shield count in inventory AFTER this call.
        cap:             The path-specific maximum shield capacity.
    """
    generated: bool
    shield: dict | None
    reason_skipped: str
    current_count: int
    cap: int


@dataclass(frozen=True, slots=True)
class TokenRefillResult:
    """Outcome of refill_tokens_for_new_year()."""
    minted: int          # New tokens created.
    total_available: int  # Total AVAILABLE tokens after refill.


# ---------------------------------------------------------------------------
# InventoryService
# ---------------------------------------------------------------------------


class InventoryService:
    """
    Item lifecycle manager for Defense Shields and Standby Tokens.

    Instantiate once per request via FastAPI dependency injection:
        inv_svc = InventoryService(db=Depends(get_db), bus=Depends(get_event_bus))

    Item state machines (journey_state_machine.md §6):
      Defense Shield:  AVAILABLE → DESTROYED (damage)  | EXPIRED (14-day timer)
      Standby Token:   AVAILABLE → ACTIVE → USED       | (7/year hard limit)
    """

    def __init__(self, db: AsyncClient, bus: "EventBus") -> None:
        self._db = db
        self._bus = bus
        self._profile_repo = ProfileRepository(db)
        self._inventory_repo = InventoryRepository(db)
        self._event_repo = EventRepository(db)

    # ------------------------------------------------------------------
    # Standby Tokens
    # ------------------------------------------------------------------

    async def consume_standby_token(
        self,
        user_id: str,
        local_date: str,
    ) -> StandbyActivationResult:
        """
        Validates token availability and activates the oldest AVAILABLE token.

        Validation checks (in order):
          1. At least one AVAILABLE token exists.
          2. No token is currently ACTIVE (one active protection at a time).

        On success:
          - Transitions oldest AVAILABLE token → ACTIVE.
          - Sets expires_at = now + 24 hours.
          - Emits STANDBY_ACTIVATED event (writes journal + notification).

        Args:
            user_id:    Player UUID.
            local_date: Player's local date "YYYY-MM-DD" for idempotency key.

        Returns:
            StandbyActivationResult with the activated token and remaining count.

        Raises:
            ValueError: If no tokens are available or one is already active (propagated from RPC).
        """
        import uuid

        now = datetime.now(timezone.utc)
        ends_at = (now + timedelta(hours=24)).isoformat()

        # Each call gets a unique idempotency key so concurrent requests cannot
        # be deduplicated into the same event — each must independently hit the
        # RPC and get accepted or rejected by the database.
        idem_key = self._event_repo.build_idempotency_key(
            user_id, local_date, "standby_activated",
            suffix=str(uuid.uuid4())[:8],
        )

        # ── Emit STANDBY_ACTIVATED event ─────────────────────────────────────
        # The mutation and invariant check are handled atomically by the RPC
        # inside the handler. ValueError is raised here if the RPC fails.
        await self._bus.emit(
            user_id=user_id,
            event_type="STANDBY_ACTIVATED",
            source="USER",
            severity="INFO",
            idempotency_key=idem_key,
            payload={
                "ends_at": ends_at,
            },
        )

        # ── Fetch final committed state ───────────────────────────────────────
        activated_token = await self._inventory_repo.get_active_standby(user_id)
        if not activated_token:
            # Should theoretically never happen unless an admin revoked it in the last ms
            raise RuntimeError(f"Failed to verify activated token for user {user_id}")

        tokens_remaining = await self._inventory_repo.count_available_tokens(user_id)

        logger.info(
            "InventoryService.consume_standby_token: user=%s token=%s ends_at=%s "
            "remaining=%d",
            user_id, activated_token.get("id"), ends_at, tokens_remaining,
        )

        return StandbyActivationResult(
            token=activated_token,
            tokens_remaining=tokens_remaining,
            ends_at=ends_at,
        )

    # ------------------------------------------------------------------
    # Defense Shields — Direct Generation
    # ------------------------------------------------------------------

    async def generate_shield(
        self,
        user_id: str,
        streak_count: int,
        active_path: str,
        local_date: str,
    ) -> dict | None:
        """
        Creates a single Defense Shield for the player, subject to the path cap.

        Called when the consecutive_clean_days threshold is confirmed (≥ 7).
        The streak counter is reset to 0 on successful generation.

        Shield specs:
          - expires_at = now + 14 days (hard, from game_rules.md §4.2)
          - Strength = 10 HP absorbed per shield per event (fixed for MVP)

        Args:
            user_id:      Player UUID.
            streak_count: The clean-day streak count that triggered generation.
            active_path:  Player's current path ("SENTINEL" allows more shields).
            local_date:   Player's local date "YYYY-MM-DD" for idempotency key.

        Returns:
            Created shield dict, or None if the player is at the path-specific cap.
        """
        cap = self._inventory_repo.get_shield_cap_for_path(active_path)
        current_count = await self._inventory_repo.count_active_shields(user_id)

        if current_count >= cap:
            logger.info(
                "InventoryService.generate_shield: user=%s at shield cap (%d/%d path=%s) "
                "— discarding new shield.",
                user_id, current_count, cap, active_path,
            )
            return None

        # ── Create shield in inventory ────────────────────────────────────────
        idem_key = self._event_repo.build_idempotency_key(
            user_id, local_date, "shield_generated", suffix=str(streak_count)
        )

        shield = await self._inventory_repo.create_shield(
            user_id, source_event_id=None
        )

        # ── Reset clean-day streak ────────────────────────────────────────────
        await self._profile_repo.reset_consecutive_clean_days(user_id)

        # ── Emit SHIELD_GENERATED event ───────────────────────────────────────
        await self._bus.emit(
            user_id=user_id,
            event_type="SHIELD_GENERATED",
            source="SYSTEM",
            severity="SUCCESS",
            idempotency_key=idem_key,
            payload={
                "streak_count": streak_count,
                "shield_id": shield.get("id"),
                "expires_at": shield.get("expires_at"),
                "path": active_path,
                "new_shield_count": current_count + 1,
                "cap": cap,
            },
        )

        logger.info(
            "InventoryService.generate_shield: user=%s shield=%s path=%s "
            "count=%d/%d streak=%d",
            user_id, shield.get("id"), active_path, current_count + 1, cap, streak_count,
        )
        return shield

    # ------------------------------------------------------------------
    # Defense Shields — Streak-Triggered Check
    # ------------------------------------------------------------------

    async def check_and_maybe_generate_shield(
        self,
        user_id: str,
        active_path: str,
        local_date: str,
        is_clean_day: bool,
    ) -> ShieldGenerationResult:
        """
        Increments or resets the clean-day streak based on today's spend behaviour,
        then generates a shield if the 7-day threshold is reached.

        Called by the midnight cron evaluation after determining whether the
        player stayed under budget today (no OVERSPEND_DETECTED event).

        Clean-day definition (game_rules.md §4.2):
          A day where total_expenses ≤ safe_daily_budget.
          Shield consumption does NOT break the streak.
          Ghost Penalty days DO break the streak (is_clean_day=False when PENDING).

        Args:
            user_id:      Player UUID.
            active_path:  Current player path (affects shield cap).
            local_date:   Player's local date "YYYY-MM-DD".
            is_clean_day: True when the player did not overspend today.

        Returns:
            ShieldGenerationResult describing the outcome.
        """
        cap = self._inventory_repo.get_shield_cap_for_path(active_path)

        if not is_clean_day:
            await self._profile_repo.reset_consecutive_clean_days(user_id)
            current_count = await self._inventory_repo.count_active_shields(user_id)
            logger.debug(
                "InventoryService: clean streak reset — user=%s (overspend or ghost day).",
                user_id,
            )
            return ShieldGenerationResult(
                generated=False,
                shield=None,
                reason_skipped="Clean streak reset (overspend or ghost penalty day).",
                current_count=current_count,
                cap=cap,
            )

        # ── Increment streak ──────────────────────────────────────────────────
        new_streak = await self._profile_repo.increment_consecutive_clean_days(user_id)
        logger.debug(
            "InventoryService: clean streak incremented — user=%s streak=%d.",
            user_id, new_streak,
        )

        if new_streak < _CLEAN_DAY_SHIELD_THRESHOLD:
            current_count = await self._inventory_repo.count_active_shields(user_id)
            return ShieldGenerationResult(
                generated=False,
                shield=None,
                reason_skipped=(
                    f"Streak at {new_streak}/{_CLEAN_DAY_SHIELD_THRESHOLD} — "
                    f"not yet at generation threshold."
                ),
                current_count=current_count,
                cap=cap,
            )

        # ── Threshold reached — attempt generation ────────────────────────────
        shield = await self.generate_shield(
            user_id=user_id,
            streak_count=new_streak,
            active_path=active_path,
            local_date=local_date,
        )

        current_count = await self._inventory_repo.count_active_shields(user_id)

        if shield is None:
            return ShieldGenerationResult(
                generated=False,
                shield=None,
                reason_skipped=(
                    f"Shield cap reached ({current_count}/{cap} for path={active_path}). "
                    f"Shield discarded."
                ),
                current_count=current_count,
                cap=cap,
            )

        return ShieldGenerationResult(
            generated=True,
            shield=shield,
            reason_skipped="",
            current_count=current_count,
            cap=cap,
        )

    # ------------------------------------------------------------------
    # Annual Token Refill
    # ------------------------------------------------------------------

    async def refill_tokens_for_new_year(
        self,
        user_id: str,
        local_date: str,
        source_event_id: str | None = None,
    ) -> TokenRefillResult:
        """
        Replenishes the Standby Token pool to the maximum annual allotment (7)
        at the start of a new 365-day Region cycle (game_rules.md §5.2).

        Only the deficit is minted — existing AVAILABLE tokens are preserved.
        ACTIVE tokens (still in their 24-hour window) are not counted against the cap,
        as they will transition to USED naturally.

        Args:
            user_id:          Player UUID.
            local_date:       Player's local date "YYYY-MM-DD" for logging.
            source_event_id:  UUID of the REGION_SHIFT_COMPLETED event for audit tracing.

        Returns:
            TokenRefillResult with the count minted and total available.
        """
        current_available = await self._inventory_repo.count_available_tokens(user_id)
        deficit = _ANNUAL_TOKEN_ALLOTMENT - current_available

        if deficit <= 0:
            logger.info(
                "InventoryService.refill_tokens_for_new_year: user=%s already at "
                "max capacity (%d/%d) — no tokens minted.",
                user_id, current_available, _ANNUAL_TOKEN_ALLOTMENT,
            )
            return TokenRefillResult(
                minted=0, total_available=current_available
            )

        new_tokens = await self._inventory_repo.refill_standby_tokens(
            user_id, source_event_id=source_event_id
        )

        total_available = current_available + len(new_tokens)
        logger.info(
            "InventoryService.refill_tokens_for_new_year: user=%s minted=%d "
            "total=%d/%d (local_date=%s).",
            user_id, len(new_tokens), total_available,
            _ANNUAL_TOKEN_ALLOTMENT, local_date,
        )

        return TokenRefillResult(
            minted=len(new_tokens),
            total_available=total_available,
        )

    # ------------------------------------------------------------------
    # Onboarding — Initial Inventory Provisioning
    # ------------------------------------------------------------------

    async def initialize_player_inventory(self, user_id: str) -> TokenRefillResult:
        """
        Mints the initial Standby Token pool for a newly onboarded player.
        Called once from the profile setup endpoint (PATCH /profile/setup).

        Grants the full annual allotment (7 tokens) upfront.
        No STANDBY_ACTIVATED event is emitted — tokens are dormant at creation.

        Returns:
            TokenRefillResult with minted count and total available.
        """
        tokens = await self._inventory_repo.initialize_starter_tokens(
            user_id, count=_ANNUAL_TOKEN_ALLOTMENT
        )
        logger.info(
            "InventoryService.initialize_player_inventory: user=%s provisioned "
            "%d starter tokens.",
            user_id, len(tokens),
        )
        return TokenRefillResult(
            minted=len(tokens),
            total_available=len(tokens),
        )

    # ------------------------------------------------------------------
    # Daily Janitor — Bulk Expiry Cleanup
    # ------------------------------------------------------------------

    async def expire_overdue_items(self) -> dict[str, int]:
        """
        Bulk-transitions all expired inventory items to their terminal states.
        Called once per UTC day by the Daily Janitor cron job.

        Operations:
          - Defense Shields:  AVAILABLE → EXPIRED  (for items past expires_at)
          - Standby Tokens:   ACTIVE    → USED     (for tokens past expires_at)

        SHIELD_EXPIRED events are NOT individually emitted here for performance —
        the Janitor handles thousands of users. The bulk update in the DB is
        sufficient for the audit trail at this scale.

        Returns:
            Dict with keys "shields_expired" and "tokens_used" and their counts.
        """
        shields_expired = await self._inventory_repo.expire_overdue_shields()
        tokens_used = await self._inventory_repo.expire_stale_active_tokens()

        logger.info(
            "InventoryService.expire_overdue_items: shields_expired=%d tokens_used=%d",
            shields_expired, tokens_used,
        )
        return {
            "shields_expired": shields_expired,
            "tokens_used": tokens_used,
        }

    # ------------------------------------------------------------------
    # Read Helpers
    # ------------------------------------------------------------------

    async def get_inventory_summary(self, user_id: str) -> dict:
        """
        Returns the concurrently-fetched inventory snapshot for the bootstrap payload.
        Delegates to InventoryRepository.get_inventory_summary() which uses asyncio.gather.
        """
        return await self._inventory_repo.get_inventory_summary(user_id)

    async def is_standby_protected(self, user_id: str) -> bool:
        """
        Returns True if the player has an ACTIVE, non-expired Standby Token.
        Used by the midnight cron Ghost Penalty check.
        """
        return await self._inventory_repo.is_standby_active(user_id)

    def get_shield_cap(self, active_path: str) -> int:
        """Returns the path-specific shield capacity without DB access."""
        return self._inventory_repo.get_shield_cap_for_path(active_path)

"""
src/backend/journey/services/hp_svc.py

Manages all HP mutations and the Damage Resolution Engine for the Journey Engine.

Responsibilities:
  - Shield-first damage resolution (journey_game_rules.md §2.1):
      1. Compute base damage from the caller.
      2. If an AVAILABLE shield exists and skip_shield=False → destroy it,
         absorb all damage, emit SHIELD_DESTROYED. No HP change.
      3. Otherwise → HP = max(0, current_HP − base_damage).
  - Vitality state derivation: NORMAL (31–100), HAZARD (1–30), CRITICAL_FAILURE (0).
  - Critical failure detection and account lock (§2.2).
  - Healing logic with 100-HP ceiling.
  - Financial Audit recovery — the only way out of CRITICAL_FAILURE (§2.2).

Strict rules (backend_logic.md):
  - Ghost Penalty damage MUST pass skip_shield=True (shields don't block inactivity).
  - The HP floor is always 0 — negative HP is never stored.
  - The HP ceiling is always 100 — heals cannot exceed max HP.
  - All HP mutations emit SHIELD_DESTROYED or HP_CRITICAL_FAILURE as appropriate
    so the event ledger remains the authoritative audit trail.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from supabase import AsyncClient

from ..repos.event_repo import EventRepository
from ..repos.inventory_repo import InventoryRepository
from ..repos.profile_repo import ProfileRepository

if TYPE_CHECKING:
    from ..engine.bus import EventBus

logger = logging.getLogger(__name__)

_HP_MIN = 0
_HP_MAX = 100
_AUDIT_RESTORE_HP = 10  # HP restored by Financial Audit (game_rules.md §2.2)


# ---------------------------------------------------------------------------
# Pure Helpers
# ---------------------------------------------------------------------------


def _vitality_from_hp(hp: int) -> str:
    """
    Derives the vitality state string from a raw HP integer.
    HP 31–100 → "NORMAL"  |  HP 1–30 → "HAZARD"  |  HP ≤ 0 → "CRITICAL_FAILURE"
    """
    if hp <= 0:
        return "CRITICAL_FAILURE"
    if hp <= 30:
        return "HAZARD"
    return "NORMAL"


def _clamp_hp(value: int) -> int:
    return max(_HP_MIN, min(_HP_MAX, value))


# ---------------------------------------------------------------------------
# Result Types
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class DamageResult:
    """
    Outcome of a single apply_damage() call.

    Attributes:
        base_damage:                 Damage requested by the caller.
        final_damage:                Damage actually applied to HP (0 if shield absorbed).
        shield_consumed:             True when a Defense Shield absorbed the hit.
        hp_before:                   HP before this call.
        hp_after:                    HP after this call (0 if critical failure).
        vitality_after:              Derived vitality string after HP change.
        critical_failure_triggered:  True when HP_CRITICAL_FAILURE event was emitted.
    """
    base_damage: int
    final_damage: int
    shield_consumed: bool
    hp_before: int
    hp_after: int
    vitality_after: str
    critical_failure_triggered: bool


@dataclass(frozen=True, slots=True)
class HealResult:
    """Outcome of a single apply_heal() call."""
    amount_applied: int   # Actual HP restored (may be less if capped at 100).
    hp_before: int
    hp_after: int
    vitality_after: str
    was_in_critical_failure: bool  # True if the player was locked before healing.


# ---------------------------------------------------------------------------
# HPService
# ---------------------------------------------------------------------------


class HPService:
    """
    Damage Resolution Engine and vitality lifecycle manager.

    Instantiate once per request via FastAPI dependency injection:
        hp_svc = HPService(db=Depends(get_db), bus=Depends(get_event_bus))

    Shield resolution order (game_rules.md §2.1):
      1. caller computes base_damage.
      2. HPService checks InventoryRepository for AVAILABLE, non-expired shields.
      3. If shield found → destroy oldest (FIFO by expires_at), emit SHIELD_DESTROYED,
         return DamageResult(final_damage=0, shield_consumed=True). HP unchanged.
      4. If no shield → apply damage, write new HP + vitality.
      5. If new HP == 0 → emit HP_CRITICAL_FAILURE, lock account.

    Note on Ghost Penalty:
      The Ghost Penalty bypasses shields entirely. Callers MUST set skip_shield=True
      when routing ghost penalty damage through this service.
    """

    def __init__(self, db: AsyncClient, bus: "EventBus") -> None:
        self._db = db
        self._bus = bus
        self._profile_repo = ProfileRepository(db)
        self._inventory_repo = InventoryRepository(db)
        self._event_repo = EventRepository(db)

    # ------------------------------------------------------------------
    # Damage Resolution
    # ------------------------------------------------------------------

    async def apply_damage(
        self,
        user_id: str,
        source_event: str,
        base_damage: int,
        local_date: str,
        skip_shield: bool = False,
    ) -> DamageResult:
        """
        Routes incoming damage through the Damage Resolution Engine.

        Args:
            user_id:      Player UUID.
            source_event: Origin event string for event payloads and logging.
            base_damage:  Pre-calculated HP damage to apply (must be ≥ 0).
            local_date:   Player's local date "YYYY-MM-DD" for idempotency keys.
            skip_shield:  If True, skip shield resolution entirely.
                          Required for Ghost Penalty — shields do NOT block inactivity.

        Returns:
            DamageResult describing the full resolution outcome.
        """
        if base_damage < 0:
            logger.warning(
                "HPService.apply_damage: negative base_damage=%d received for user=%s "
                "source=%s — treating as 0.",
                base_damage, user_id, source_event,
            )
            base_damage = 0

        profile = await self._profile_repo.get_profile(user_id)
        if not profile:
            logger.error(
                "HPService.apply_damage: profile not found for user=%s.", user_id
            )
            return DamageResult(
                base_damage=base_damage, final_damage=0,
                shield_consumed=False, hp_before=0, hp_after=0,
                vitality_after="CRITICAL_FAILURE",
                critical_failure_triggered=False,
            )

        hp_before: int = profile.get("current_hp", _HP_MAX)

        # ── Zero-damage shortcut ──────────────────────────────────────────────
        if base_damage == 0:
            vitality = _vitality_from_hp(hp_before)
            return DamageResult(
                base_damage=0, final_damage=0, shield_consumed=False,
                hp_before=hp_before, hp_after=hp_before,
                vitality_after=vitality,
                critical_failure_triggered=False,
            )

        # ── Shield resolution (damage events only) ────────────────────────────
        if not skip_shield:
            shield_result = await self._attempt_shield_absorption(
                user_id=user_id,
                damage_blocked=base_damage,
                source_event=source_event,
                local_date=local_date,
            )
            if shield_result is not None:
                # Shield absorbed the hit — return early, HP unchanged.
                vitality = _vitality_from_hp(hp_before)
                return DamageResult(
                    base_damage=base_damage,
                    final_damage=0,
                    shield_consumed=True,
                    hp_before=hp_before,
                    hp_after=hp_before,
                    vitality_after=vitality,
                    critical_failure_triggered=False,
                )

        # ── Apply damage to HP ────────────────────────────────────────────────
        hp_after = _clamp_hp(hp_before - base_damage)
        vitality_after = _vitality_from_hp(hp_after)

        await self._profile_repo.update_hp_and_vitality(
            user_id, hp_after, vitality_after
        )

        logger.info(
            "HPService.apply_damage: user=%s source=%s damage=%d hp=%d→%d vitality=%s",
            user_id, source_event, base_damage, hp_before, hp_after, vitality_after,
        )

        # ── Critical failure gate ─────────────────────────────────────────────
        cf_triggered = False
        if hp_after == 0:
            await self.evaluate_critical_failure(
                user_id=user_id,
                source_event=source_event,
                local_date=local_date,
            )
            cf_triggered = True

        return DamageResult(
            base_damage=base_damage,
            final_damage=base_damage,
            shield_consumed=False,
            hp_before=hp_before,
            hp_after=hp_after,
            vitality_after=vitality_after,
            critical_failure_triggered=cf_triggered,
        )

    # ------------------------------------------------------------------
    # Healing
    # ------------------------------------------------------------------

    async def apply_heal(
        self,
        user_id: str,
        source_event: str,
        amount: int,
        local_date: str,
        override_critical_failure: bool = False,
    ) -> HealResult:
        """
        Restores HP, capped at the maximum of 100.

        When override_critical_failure=True (Financial Audit flow), the heal
        is applied even while vitality=CRITICAL_FAILURE. The vitality state
        is automatically recalculated from the new HP value, effectively
        unlocking the account once HP > 0.

        Args:
            user_id:                    Player UUID.
            source_event:               Origin identifier for logging.
            amount:                     HP to restore (must be ≥ 0).
            local_date:                 Player's local date "YYYY-MM-DD".
            override_critical_failure:  If True, allows healing from CF state.

        Returns:
            HealResult describing the pre/post HP and vitality state.
        """
        if amount < 0:
            logger.warning(
                "HPService.apply_heal: negative amount=%d for user=%s — ignoring.",
                amount, user_id,
            )
            amount = 0

        profile = await self._profile_repo.get_profile(user_id)
        if not profile:
            logger.error(
                "HPService.apply_heal: profile not found for user=%s.", user_id
            )
            return HealResult(
                amount_applied=0, hp_before=0, hp_after=0,
                vitality_after="CRITICAL_FAILURE",
                was_in_critical_failure=False,
            )

        hp_before: int = profile.get("current_hp", 0)
        vitality_before: str = profile.get("vitality", "NORMAL")
        was_cf = vitality_before == "CRITICAL_FAILURE"

        if was_cf and not override_critical_failure:
            logger.warning(
                "HPService.apply_heal: user=%s is in CRITICAL_FAILURE — "
                "heal blocked. Use override_critical_failure=True for audits.",
                user_id,
            )
            return HealResult(
                amount_applied=0, hp_before=hp_before, hp_after=hp_before,
                vitality_after=vitality_before,
                was_in_critical_failure=True,
            )

        hp_after = _clamp_hp(hp_before + amount)
        amount_applied = hp_after - hp_before  # Actual heal (may be less if at cap)
        vitality_after = _vitality_from_hp(hp_after)

        await self._profile_repo.update_hp_and_vitality(
            user_id, hp_after, vitality_after
        )

        logger.info(
            "HPService.apply_heal: user=%s source=%s heal=%d→applied=%d "
            "hp=%d→%d vitality=%s",
            user_id, source_event, amount, amount_applied,
            hp_before, hp_after, vitality_after,
        )

        return HealResult(
            amount_applied=amount_applied,
            hp_before=hp_before,
            hp_after=hp_after,
            vitality_after=vitality_after,
            was_in_critical_failure=was_cf,
        )

    # ------------------------------------------------------------------
    # Critical Failure Detection
    # ------------------------------------------------------------------

    async def evaluate_critical_failure(
        self,
        user_id: str,
        source_event: str,
        local_date: str,
    ) -> None:
        """
        Locks the player's account when HP reaches 0 (game_rules.md §2.2).

        Effects:
          - Confirms vitality=CRITICAL_FAILURE in journey_profiles.
          - Emits HP_CRITICAL_FAILURE event, which triggers:
              • Journal entry: "Account Locked — HP reached 0."
              • Notification (HAZARD/DANGER): "Account Locked"

        Endpoints gated by CF (journey_state_machine.md §1 Restrictions):
          POST /claim/zero-spend   → 403 CRITICAL_FAILURE_ACTIVE
          POST /standby/use        → 403 CRITICAL_FAILURE_ACTIVE
          (Wallet logging, audit, and reward claim remain accessible.)

        Recovery: POST /revive → execute_financial_audit().

        Args:
            user_id:      Player UUID.
            source_event: The event that caused HP to hit 0 (for event payload).
            local_date:   Player's local date "YYYY-MM-DD" for idempotency key.
        """
        # Re-confirm the CRITICAL_FAILURE state in the DB as an authoritative write.
        await self._profile_repo.update_hp_and_vitality(
            user_id, new_hp=0, vitality="CRITICAL_FAILURE"
        )

        idem_key = self._event_repo.build_idempotency_key(
            user_id, local_date, "hp_critical_failure"
        )
        await self._bus.emit(
            user_id=user_id,
            event_type="HP_CRITICAL_FAILURE",
            source="ENGINE",
            severity="DANGER",
            idempotency_key=idem_key,
            payload={"final_hp": 0, "source_event": source_event},
        )

        logger.warning(
            "HPService.evaluate_critical_failure: user=%s locked — HP=0 source=%s",
            user_id, source_event,
        )

    # ------------------------------------------------------------------
    # Financial Audit Recovery
    # ------------------------------------------------------------------

    async def execute_financial_audit(
        self,
        user_id: str,
        local_date: str,
    ) -> HealResult:
        """
        Executes the Financial Audit recovery flow (game_rules.md §2.2).

        Restores the player from CRITICAL_FAILURE to HAZARD state:
          - HP is set to 10 (the recovery floor).
          - Vitality transitions from CRITICAL_FAILURE → HAZARD.
          - FINANCIAL_AUDIT_COMPLETED event is emitted, which writes the
            journal and sends the "Account Restored" system notification.

        This is the ONLY way to exit CRITICAL_FAILURE. The endpoint
        POST /revive calls this method after verifying audit_acknowledged=True.

        Returns:
            HealResult with hp_after=10 and vitality_after="HAZARD".
        """
        profile = await self._profile_repo.get_profile(user_id)
        if not profile:
            logger.error(
                "HPService.execute_financial_audit: profile missing for user=%s.", user_id
            )
            return HealResult(
                amount_applied=0, hp_before=0, hp_after=0,
                vitality_after="CRITICAL_FAILURE",
                was_in_critical_failure=True,
            )

        hp_before: int = profile.get("current_hp", 0)
        vitality_before: str = profile.get("vitality", "CRITICAL_FAILURE")

        if vitality_before != "CRITICAL_FAILURE":
            logger.info(
                "HPService.execute_financial_audit: user=%s is not in CRITICAL_FAILURE "
                "(vitality=%s) — no action taken.",
                user_id, vitality_before,
            )
            return HealResult(
                amount_applied=0,
                hp_before=hp_before,
                hp_after=hp_before,
                vitality_after=vitality_before,
                was_in_critical_failure=False,
            )

        # ── Check Overspending ───────────────────────────────────────────────
        # Verify that the player actually has overspending this month.
        # This prevents free revives when the player just hit 0 HP without overspending.
        now = datetime.now(timezone.utc)
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # 1. Fetch categories with limits
        cat_res = await self._db.table("categories").select("id, monthly_limit").eq("user_id", user_id).gt("monthly_limit", 0).execute()
        categories_with_limits = cat_res.data or []
        
        if not categories_with_limits:
            raise ValueError("Financial Audit requires overspending, but no category limits are set.")

        limit_map = {c["id"]: c["monthly_limit"] for c in categories_with_limits}
        
        # 2. Fetch expenses for the current month
        tx_res = await self._db.table("transactions").select("category_id, amount")\
            .eq("user_id", user_id)\
            .eq("type", "expense")\
            .gte("logged_at", start_of_month.isoformat())\
            .execute()
            
        transactions = tx_res.data or []
        
        # 3. Aggregate expenses by category
        expense_by_cat = {}
        for tx in transactions:
            cid = tx.get("category_id")
            if cid in limit_map:
                expense_by_cat[cid] = expense_by_cat.get(cid, 0) + float(tx["amount"])
                
        # 4. Check for any overspending
        has_overspending = False
        for cid, spent in expense_by_cat.items():
            if spent > limit_map[cid]:
                has_overspending = True
                break
                
        if not has_overspending:
            raise ValueError("Financial Audit failed: No overspending detected in the current month.")

        # ── Apply the audit HP restoration (bypasses CF block) ──────────────
        heal_result = await self.apply_heal(
            user_id=user_id,
            source_event="FINANCIAL_AUDIT_COMPLETED",
            amount=_AUDIT_RESTORE_HP,
            local_date=local_date,
            override_critical_failure=True,
        )

        # Emit FINANCIAL_AUDIT_COMPLETED — handler writes journal + notification.
        idem_key = self._event_repo.build_idempotency_key(
            user_id, local_date, "financial_audit_completed"
        )
        await self._bus.emit(
            user_id=user_id,
            event_type="FINANCIAL_AUDIT_COMPLETED",
            source="USER",
            severity="SUCCESS",
            idempotency_key=idem_key,
            payload={"restored_hp": _AUDIT_RESTORE_HP},
        )

        logger.info(
            "HPService.execute_financial_audit: user=%s recovered — "
            "hp=%d→%d vitality=CRITICAL_FAILURE→%s",
            user_id, hp_before, heal_result.hp_after, heal_result.vitality_after,
        )

        return heal_result

    # ------------------------------------------------------------------
    # Read Helpers (no I/O — safe for validators and response builders)
    # ------------------------------------------------------------------

    @staticmethod
    def derive_vitality(hp: int) -> str:
        """Pure vitality derivation. No DB access."""
        return _vitality_from_hp(hp)

    @staticmethod
    def is_critical_failure(hp: int) -> bool:
        """Returns True if the given HP value indicates CRITICAL_FAILURE."""
        return hp <= 0

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    async def _attempt_shield_absorption(
        self,
        user_id: str,
        damage_blocked: int,
        source_event: str,
        local_date: str,
    ) -> dict | None:
        """
        Attempts to absorb incoming damage with the oldest available shield.

        Returns the destroyed shield dict if absorption occurred, else None.
        Emits SHIELD_DESTROYED if a shield was consumed so the event ledger
        and journal reflect the block.
        """
        destroyed = await self._inventory_repo.destroy_oldest_shield(user_id)
        if destroyed is None:
            return None

        idem_key = self._event_repo.build_idempotency_key(
            user_id, local_date, "shield_destroyed",
            suffix=destroyed["id"][:8],
        )
        await self._bus.emit(
            user_id=user_id,
            event_type="SHIELD_DESTROYED",
            source="ENGINE",
            severity="WARNING",
            idempotency_key=idem_key,
            payload={
                "shield_id": destroyed["id"],
                "damage_blocked": damage_blocked,
                "source_event": source_event,
            },
        )

        logger.info(
            "HPService: shield absorbed %d damage for user=%s (shield=%s source=%s).",
            damage_blocked, user_id, destroyed["id"], source_event,
        )
        return destroyed

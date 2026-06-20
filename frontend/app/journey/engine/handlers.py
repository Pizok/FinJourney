"""
src/backend/journey/events/handlers.py

Handler functions for every Journey Engine event type.

Registration:
  Each handler is decorated with @on("EVENT_TYPE"), which inserts it into
  the module-level REGISTRY dict. EventBus._load_handlers() imports this
  module lazily on first publish(), at which point all @on() decorators
  have already executed and REGISTRY is fully populated.

Handler contract:
  - Every handler is an async coroutine: async def handle_*(ctx: EventContext) -> None
  - Handlers receive an EventContext with access to ctx.bus, ctx.db, ctx.payload.
  - Handlers NEVER calculate HP, XP, or levels inline — they delegate to services
    (imported locally to prevent circular imports) or emit derived ENGINE events.
  - Handlers emit cascading events via: await ctx.bus.emit(user_id=..., ...)
  - Handlers write journal entries and notifications as their final "distribution" step.
  - All service imports are local (inside function body) to break circular dependencies.

Idempotency:
  All ctx.bus.emit() calls use deterministic idempotency_keys. If a cascading
  event has already been processed (e.g. from a cron retry), EventBus returns
  the existing row and the handler chain is skipped automatically.

Event coverage (journey_event_system.md):
  USER   — EXPENSE_LOGGED, INCOME_LOGGED, ZERO_SPEND_CLAIMED, STANDBY_ACTIVATED,
            PATH_CHANGED, REWARD_CLAIMED, FINANCIAL_AUDIT_COMPLETED
  SYSTEM — MIDNIGHT_EVALUATION_STARTED, GHOST_PENALTY_APPLIED, SHIELD_GENERATED,
            SHIELD_EXPIRED, STANDBY_USED, CHALLENGE_STARTED, QUARTER_FAILED,
            REGION_SHIFT_PENDING, REGION_SHIFT_COMPLETED
  ENGINE — XP_CHANGED, HP_CHANGED, OVERSPEND_DETECTED, SHIELD_DESTROYED, LEVEL_UP,
            FEATURE_UNLOCKED, HP_CRITICAL_FAILURE, QUARTER_COMPLETED,
            PASSPORT_STAMP_EARNED
"""
from __future__ import annotations

import logging
import math
from datetime import date, datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any, Awaitable, Callable

if TYPE_CHECKING:
    # Only evaluated by type checkers — safe despite bus.py importing this module.
    from .bus import EventContext

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Registry & Decorator
# ---------------------------------------------------------------------------

HandlerFn = Callable[["EventContext"], Awaitable[None]]
REGISTRY: dict[str, HandlerFn] = {}


def on(event_type: str) -> Callable[[HandlerFn], HandlerFn]:
    """
    Registers a coroutine as the sole handler for an event_type.
    Duplicate registrations raise immediately at import time to catch misconfigs.

    Usage:
        @on("EXPENSE_LOGGED")
        async def handle_expense_logged(ctx: EventContext) -> None:
            ...
    """

    def decorator(fn: HandlerFn) -> HandlerFn:
        if event_type in REGISTRY:
            raise RuntimeError(
                f"Duplicate handler for event_type='{event_type}'. "
                f"Existing: {REGISTRY[event_type].__name__}, "
                f"Attempted: {fn.__name__}."
            )
        REGISTRY[event_type] = fn
        return fn

    return decorator


# ---------------------------------------------------------------------------
# Pure Utility Functions  (no I/O — safe to call anywhere)
# ---------------------------------------------------------------------------


def _level_from_xp(total_xp: int) -> int:
    """
    Derives player level from total XP.
    Formula (logic.md): L = floor(sqrt(XP / 100)) + 1
    """
    return math.floor(math.sqrt(max(0, total_xp) / 100)) + 1


def _xp_threshold_for_level(level: int) -> int:
    """
    Total XP required to reach `level`.
    Inverse of _level_from_xp: threshold = (L - 1)^2 * 100
    """
    return (max(1, level) - 1) ** 2 * 100


def _xp_needed_for_next_level(current_level: int, current_xp: int) -> int:
    """XP still required to cross into the next level from current_xp."""
    return max(0, _xp_threshold_for_level(current_level + 1) - current_xp)


def _vitality_from_hp(hp: int) -> str:
    """
    Derives vitality state string from a raw HP integer.
    HP 31–100 → NORMAL | HP 1–30 → HAZARD | HP ≤ 0 → CRITICAL_FAILURE
    """
    if hp <= 0:
        return "CRITICAL_FAILURE"
    if hp <= 30:
        return "HAZARD"
    return "NORMAL"


def _today_iso() -> str:
    """Returns today's UTC date as ISO-8601 string. Convenience for idempotency keys."""
    return datetime.now(timezone.utc).date().isoformat()


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Static Registries
# ---------------------------------------------------------------------------

# Level → list[feature_key] unlocked at that level.
# Must stay in sync with the journey_levels table and feature gate middleware.
LEVEL_UNLOCK_REGISTRY: dict[int, list[str]] = {
    2: ["custom_tasks", "wallet_icons", "category_icons"],
    3: ["analytics", "unlimited_wallets", "unlimited_categories", "monthly_review"],
    5: ["advanced_analytics", "wallet_goals"],
    7: ["premium_theme_trial"],
    10: ["guild_shop_expanded"],
}

# Human-readable labels for FEATURE_UNLOCKED notifications.
_FEATURE_LABELS: dict[str, str] = {
    "custom_tasks": "Custom Tasks",
    "wallet_icons": "Wallet Icons",
    "category_icons": "Category Icons",
    "analytics": "Analytics Dashboard",
    "unlimited_wallets": "Unlimited Wallets",
    "unlimited_categories": "Unlimited Categories",
    "monthly_review": "Monthly Review",
    "advanced_analytics": "Advanced Analytics",
    "wallet_goals": "Wallet Goals",
    "premium_theme_trial": "Premium Theme Trial",
    "guild_shop_expanded": "Expanded Guild Shop",
}

# Base XP grants per action (before path multipliers).
_BASE_XP: dict[str, int] = {
    "expense_logged": 5,
    "income_logged": 5,
    "zero_spend_claimed": 10,
}

# Path-specific XP overrides keyed by (path, action).
_PATH_XP_OVERRIDES: dict[str, dict[str, int]] = {
    "CATALYST": {"income_logged": 10},
    "PHANTOM": {"zero_spend_claimed": 15},
}

# Ghost Penalty HP damage per path.
_GHOST_PENALTY_DAMAGE: dict[str, int] = {
    "PHANTOM": 5,
    "_default": 10,
}

# Static region rotation sequence. Production: query region_catalog instead.
_REGION_SEQUENCE: list[str] = [
    "quiet_valley",
    "iron_coast",
    "ember_plateau",
    "frost_peaks",
    "jade_expanse",
]


# ---------------------------------------------------------------------------
# Internal Helpers
# ---------------------------------------------------------------------------


def _resolve_xp_grant(action: str, active_path: str) -> int:
    """Returns the effective XP grant for an action, respecting path multipliers."""
    path_overrides = _PATH_XP_OVERRIDES.get(active_path, {})
    return path_overrides.get(action, _BASE_XP.get(action, 0))


def _next_region_id(current_region_id: str) -> str:
    """Cycles to the next region in the static sequence. Wraps around."""
    try:
        idx = _REGION_SEQUENCE.index(current_region_id)
        return _REGION_SEQUENCE[(idx + 1) % len(_REGION_SEQUENCE)]
    except ValueError:
        logger.warning(
            "Region '%s' not found in sequence — defaulting to %s.",
            current_region_id,
            _REGION_SEQUENCE[0],
        )
        return _REGION_SEQUENCE[0]


def _evaluate_challenge_win_conditions(progress_data: dict[str, Any]) -> bool:
    """
    Returns True when all win conditions in progress_data are satisfied.
    Each condition must have 'current' >= 'target'.
    An empty conditions list is treated as auto-fail (misconfigured template).
    """
    conditions: list[dict[str, Any]] = progress_data.get("win_conditions", [])
    if not conditions:
        return False
    return all(c.get("current", 0) >= c.get("target", 1) for c in conditions)


async def _emit_xp_changed(
    ctx: "EventContext",
    delta: int,
    source_event: str,
    local_date: str,
    suffix: str = "",
) -> None:
    """Convenience wrapper: emits an XP_CHANGED event with a consistent idempotency key."""
    from ..repos.event_repo import EventRepository

    key = EventRepository.build_idempotency_key(
        ctx.user_id, local_date, "xp_changed",
        suffix=f"{source_event.lower()}{('_' + suffix) if suffix else ''}",
    )
    await ctx.bus.emit(
        user_id=ctx.user_id,
        event_type="XP_CHANGED",
        source="ENGINE",
        severity="SUCCESS",
        idempotency_key=key,
        payload={"delta": delta, "source_event": source_event},
    )


async def _emit_hp_changed(
    ctx: "EventContext",
    delta: int,
    source_event: str,
    local_date: str,
    skip_shield: bool = False,
    suffix: str = "",
    override_critical_failure: bool = False,
) -> None:
    """Convenience wrapper: emits an HP_CHANGED event with a consistent idempotency key."""
    from ..repos.event_repo import EventRepository

    severity = "SUCCESS" if delta > 0 else ("WARNING" if delta > -15 else "DANGER")
    key = EventRepository.build_idempotency_key(
        ctx.user_id, local_date, "hp_changed",
        suffix=f"{source_event.lower()}{('_' + suffix) if suffix else ''}",
    )
    await ctx.bus.emit(
        user_id=ctx.user_id,
        event_type="HP_CHANGED",
        source="ENGINE",
        severity=severity,
        idempotency_key=key,
        payload={
            "delta": delta,
            "source_event": source_event,
            "skip_shield": skip_shield,
            "override_critical_failure": override_critical_failure,
        },
    )


async def _write_journal(
    ctx: "EventContext",
    message: str,
    severity: str,
) -> None:
    """Appends an immutable journal entry. Extracted to keep handler bodies lean."""
    from ..repos.profile_repo import ProfileRepository

    repo = ProfileRepository(ctx.db)
    await repo.insert_journal_entry({
        "user_id": ctx.user_id,
        "source_event_id": ctx.event_id,
        "message": message,
        "severity": severity,
    })


async def _write_notification(
    ctx: "EventContext",
    *,
    category: str,
    severity: str,
    title: str,
    message: str,
    action_type: str = "none",
    action_payload: dict[str, Any] | None = None,
) -> None:
    """Creates a notification record. Extracted to keep handler bodies lean."""
    from ..repos.profile_repo import ProfileRepository

    repo = ProfileRepository(ctx.db)
    row: dict[str, Any] = {
        "user_id": ctx.user_id,
        "source_event_id": ctx.event_id,
        "category": category,
        "severity": severity,
        "status": "UNREAD",
        "title": title,
        "message": message,
        "action_type": action_type,
    }
    if action_payload is not None:
        row["action_payload"] = action_payload
    await repo.insert_notification(row)


# ===========================================================================
# ── USER EVENT HANDLERS ─────────────────────────────────────────────────────
# ===========================================================================


@on("EXPENSE_LOGGED")
async def handle_expense_logged(ctx: "EventContext") -> None:
    """
    Processes a logged expense transaction.

    Full chain:
      EXPENSE_LOGGED
        ├─ If SAFE_CLAIMED today → emit XP_CHANGED (negative, revoke ZS bonus)
        ├─ Transition survival state PENDING/SAFE_CLAIMED → SAFE_LOGGED
        ├─ [ONCE/DAY cap] emit XP_CHANGED (+5)
        └─ If is_over_budget → emit OVERSPEND_DETECTED

    Publish: Journal ("Logged Expense: Rp X")

    Payload fields:
        amount           (int)   Transaction amount in local currency.
        is_over_budget   (bool)  True when this expense pushed daily spend over budget.
        variance         (int)   Amount over budget (used by OVERSPEND_DETECTED).
        transaction_id   (str)   UUID of the source transaction for idempotency suffix.
        category_id      (str)   Category UUID for challenge tracker updates.
        local_date       (str)   Player's local date "YYYY-MM-DD".
    """
    from ..repos.profile_repo import ProfileRepository
    from ..repos.event_repo import EventRepository

    profile_repo = ProfileRepository(ctx.db)
    event_repo = EventRepository(ctx.db)

    amount: int = ctx.payload.get("amount", 0)
    is_over_budget: bool = ctx.payload.get("is_over_budget", False)
    variance: int = ctx.payload.get("variance", 0)
    transaction_id: str = ctx.payload.get("transaction_id", "")
    category_id: str | None = ctx.payload.get("category_id")
    local_date: str = ctx.payload.get("local_date", _today_iso())
    today: date = date.fromisoformat(local_date)

    daily_survival = await profile_repo.get_daily_survival(ctx.user_id)
    current_status: str = daily_survival.get("status", "PENDING") if daily_survival else "PENDING"

    # ── 1. Revoke zero-spend XP if SAFE_CLAIMED ─────────────────────────────
    if current_status == "SAFE_CLAIMED":
        profile = await profile_repo.get_profile(ctx.user_id)
        active_path = profile.get("active_path", "UNASSIGNED") if profile else "UNASSIGNED"
        xp_to_revoke = -(_resolve_xp_grant("zero_spend_claimed", active_path))

        await profile_repo.revoke_zero_spend_xp(ctx.user_id, today)
        await _emit_xp_changed(
            ctx, xp_to_revoke, "ZERO_SPEND_XP_REVOKED", local_date,
            suffix="revoke",
        )
        logger.info(
            "EXPENSE_LOGGED: zero-spend XP revoked %d for user=%s (expense after ZS claim).",
            xp_to_revoke, ctx.user_id,
        )

    # ── 2. Transition survival state to SAFE_LOGGED ──────────────────────────
    if daily_survival and current_status in ("PENDING", "SAFE_CLAIMED"):
        await profile_repo.set_survival_status(ctx.user_id, today, "SAFE_LOGGED")

    # ── 3. Grant XP (daily cap enforced via journey_daily_xp) ────────────────
    daily_xp = await profile_repo.ensure_daily_xp_record(ctx.user_id, today)
    if daily_xp and not daily_xp.get("expense_xp_claimed", False):
        await profile_repo.mark_expense_xp_claimed(ctx.user_id, today)
        await _emit_xp_changed(ctx, _BASE_XP["expense_logged"], "EXPENSE_LOGGED", local_date)

    # ── 4. Journal ───────────────────────────────────────────────────────────
    await _write_journal(ctx, f"Logged expense of Rp {amount:,}.", "INFO")

    # ── 5. Overspend → damage cascade ────────────────────────────────────────
    if is_over_budget:
        idem_key = event_repo.build_idempotency_key(
            ctx.user_id, local_date, "overspend_detected",
            suffix=transaction_id[:8] if transaction_id else "x",
        )
        await ctx.bus.emit(
            user_id=ctx.user_id,
            event_type="OVERSPEND_DETECTED",
            source="ENGINE",
            severity="WARNING",
            idempotency_key=idem_key,
            payload={
                "variance": variance,
                "category_id": category_id,
                "source_transaction_id": transaction_id,
                "local_date": local_date,
            },
        )


@on("INCOME_LOGGED")
async def handle_income_logged(ctx: "EventContext") -> None:
    """
    Processes a logged income transaction.

    Full chain:
      INCOME_LOGGED
        ├─ If PENDING → transition survival state to SAFE_LOGGED
        │  (Income does NOT revoke SAFE_CLAIMED — only expenses do)
        └─ [ONCE/DAY cap] emit XP_CHANGED (+5, or +10 for CATALYST path)

    Publish: Journal ("Logged Income: Rp X")

    Payload fields:
        amount      (int) Transaction amount.
        local_date  (str) Player's local date "YYYY-MM-DD".
    """
    from ..repos.profile_repo import ProfileRepository

    profile_repo = ProfileRepository(ctx.db)

    amount: int = ctx.payload.get("amount", 0)
    local_date: str = ctx.payload.get("local_date", _today_iso())
    today: date = date.fromisoformat(local_date)

    # ── 1. Survival state transition (PENDING only — income preserves SAFE_CLAIMED) ──
    daily_survival = await profile_repo.get_daily_survival(ctx.user_id)
    if daily_survival and daily_survival.get("status") == "PENDING":
        await profile_repo.set_survival_status(ctx.user_id, today, "SAFE_LOGGED")

    # ── 2. Grant XP (once/day, path-aware) ───────────────────────────────────
    daily_xp = await profile_repo.ensure_daily_xp_record(ctx.user_id, today)
    if daily_xp and not daily_xp.get("income_xp_claimed", False):
        profile = await profile_repo.get_profile(ctx.user_id)
        active_path = profile.get("active_path", "UNASSIGNED") if profile else "UNASSIGNED"
        xp_grant = _resolve_xp_grant("income_logged", active_path)

        await profile_repo.mark_income_xp_claimed(ctx.user_id, today)
        await _emit_xp_changed(ctx, xp_grant, "INCOME_LOGGED", local_date)

    # ── 3. Journal ───────────────────────────────────────────────────────────
    await _write_journal(ctx, f"Logged income of Rp {amount:,}.", "INFO")


@on("ZERO_SPEND_CLAIMED")
async def handle_zero_spend_claimed(ctx: "EventContext") -> None:
    """
    Processes a Zero-Spend Day claim.

    Full chain:
      ZERO_SPEND_CLAIMED
        ├─ Transition survival state to SAFE_CLAIMED
        └─ emit XP_CHANGED (+10, or +15 for PHANTOM path)

    Publish: Journal ("Claimed Zero-Spend Day")

    Payload fields:
        local_date (str) Player's local date "YYYY-MM-DD".
    """
    from ..repos.profile_repo import ProfileRepository

    profile_repo = ProfileRepository(ctx.db)

    local_date: str = ctx.payload.get("local_date", _today_iso())
    today: date = date.fromisoformat(local_date)

    # ── 1. Survival state ─────────────────────────────────────────────────────
    await profile_repo.set_survival_status(ctx.user_id, today, "SAFE_CLAIMED")

    # ── 2. Mark XP cap record ─────────────────────────────────────────────────
    await profile_repo.ensure_daily_xp_record(ctx.user_id, today)
    await profile_repo.mark_zero_spend_xp_claimed(ctx.user_id, today)

    # ── 3. Grant XP (path-aware) ──────────────────────────────────────────────
    profile = await profile_repo.get_profile(ctx.user_id)
    active_path = profile.get("active_path", "UNASSIGNED") if profile else "UNASSIGNED"
    xp_grant = _resolve_xp_grant("zero_spend_claimed", active_path)

    await _emit_xp_changed(ctx, xp_grant, "ZERO_SPEND_CLAIMED", local_date)

    # ── 4. Journal ───────────────────────────────────────────────────────────
    await _write_journal(
        ctx,
        "Claimed Zero-Spend Day — Ghost Penalty protection is active for today.",
        "SUCCESS",
    )


@on("STANDBY_ACTIVATED")
async def handle_standby_activated(ctx: "EventContext") -> None:
    """
    Records Standby Token activation.
    The inventory mutation (AVAILABLE → ACTIVE) is performed by InventoryService
    before this event is published. This handler writes the audit trail only.

    Publish: Journal, Notification (SYSTEM)

    Payload fields:
        ends_at (str) ISO-8601 timestamp when Standby protection expires.
    """
    ends_at: str = ctx.payload.get("ends_at", "")
    await _write_journal(
        ctx,
        f"Standby Mode activated — Ghost Penalty frozen until {ends_at}.",
        "INFO",
    )
    await _write_notification(
        ctx,
        category="SYSTEM",
        severity="INFO",
        title="Standby Mode Active",
        message="Ghost Penalty protection is active for the next 24 hours.",
        action_type="none",
    )


@on("PATH_CHANGED")
async def handle_path_changed(ctx: "EventContext") -> None:
    """
    Records a player path transition.
    The profile update and 6-month cooldown are applied by the route handler
    before this event fires. This handler writes the audit trail.

    Publish: Journal, Notification (SYSTEM)

    Payload fields:
        old_path       (str) Previous path identifier.
        new_path       (str) New active path identifier.
        cooldown_until (str) ISO-8601 timestamp when the cooldown expires.
    """
    old_path: str = ctx.payload.get("old_path", "UNASSIGNED")
    new_path: str = ctx.payload.get("new_path", "UNASSIGNED")
    cooldown_until: str = ctx.payload.get("cooldown_until", "")

    await _write_journal(
        ctx,
        f"Path shifted: {old_path} → {new_path}. Locked for 6 months until {cooldown_until}.",
        "INFO",
    )
    await _write_notification(
        ctx,
        category="SYSTEM",
        severity="INFO",
        title=f"Path Changed: {new_path.title()}",
        message=(
            f"Your active path is now {new_path.title()}. "
            f"Next change available after {cooldown_until}."
        ),
        action_type="open_profile",
    )


@on("REWARD_CLAIMED")
async def handle_reward_claimed(ctx: "EventContext") -> None:
    """
    Processes a quarterly challenge reward claim.

    Full chain:
      REWARD_CLAIMED
        ├─ emit XP_CHANGED (+xp_reward)
        └─ emit HP_CHANGED (+hp_reward)

    Publish: Journal ("Claimed Challenge Reward: +X XP, +Y HP")

    Payload fields:
        challenge_id (str) UUID of the completed challenge.
        xp_reward    (int) XP granted.
        hp_reward    (int) HP restored.
    """
    xp_reward: int = ctx.payload.get("xp_reward", 0)
    hp_reward: int = ctx.payload.get("hp_reward", 0)
    challenge_id: str = ctx.payload.get("challenge_id", "")
    local_date: str = _today_iso()
    ch_suffix = challenge_id[:8]

    if xp_reward > 0:
        await _emit_xp_changed(
            ctx, xp_reward, "REWARD_CLAIMED", local_date, suffix=ch_suffix
        )
    if hp_reward > 0:
        await _emit_hp_changed(
            ctx, hp_reward, "REWARD_CLAIMED", local_date,
            skip_shield=False, suffix=ch_suffix,
        )

    await _write_journal(
        ctx,
        f"Claimed quarterly challenge reward: +{xp_reward} XP, +{hp_reward} HP.",
        "SUCCESS",
    )


@on("FINANCIAL_AUDIT_COMPLETED")
async def handle_financial_audit_completed(ctx: "EventContext") -> None:
    """
    Completes the Financial Audit recovery flow, exiting CRITICAL_FAILURE.
    Restores HP to 10 and transitions vitality to HAZARD.
    The critical_failure unlock is implicit: vitality != CRITICAL_FAILURE once HP > 0.

    Full chain:
      FINANCIAL_AUDIT_COMPLETED
        └─ emit HP_CHANGED (+10, override_critical_failure=True)

    Publish: Journal, Notification (SYSTEM: "Account Restored")

    Payload fields:
        restored_hp (int) HP to restore. Should always be 10 per spec.
    """
    restored_hp: int = ctx.payload.get("restored_hp", 10)
    local_date: str = _today_iso()

    await _emit_hp_changed(
        ctx, restored_hp, "FINANCIAL_AUDIT_COMPLETED", local_date,
        skip_shield=False,
        override_critical_failure=True,
    )

    await _write_journal(
        ctx,
        f"Financial Audit completed — HP restored to {restored_hp}. Account unlocked.",
        "SUCCESS",
    )
    await _write_notification(
        ctx,
        category="SYSTEM",
        severity="SUCCESS",
        title="Account Restored",
        message="Financial Audit complete. Your account has been unlocked.",
        action_type="navigate_to_dashboard",
    )


# ===========================================================================
# ── SYSTEM EVENT HANDLERS ───────────────────────────────────────────────────
# ===========================================================================


@on("MIDNIGHT_EVALUATION_STARTED")
async def handle_midnight_evaluation_started(ctx: "EventContext") -> None:
    """
    Master heartbeat for the rolling midnight cron job (journey_jobs_and_scheduler.md).
    Evaluates all time-sensitive conditions for one user at their local midnight.

    Evaluation sequence (all idempotent via idempotency_key):
      1. Ghost Penalty check    — if daily status is PENDING, emit GHOST_PENALTY_APPLIED.
      2. Clean-day streak       — if no overspend today, increment consecutive_clean_days.
                                  Emit SHIELD_GENERATED when streak hits 7 AND cap not reached.
      3. Challenge evaluation   — if active challenge.ends_at ≤ now, emit QUARTER_COMPLETED
                                  or QUARTER_FAILED based on win conditions.
      4. Region shift check     — if current region.ends_at ≤ now, emit REGION_SHIFT_PENDING.
      5. Advance survival row   — move current_date to the new day, reset status to PENDING.
                                  Pre-create the next day's journey_daily_xp record.

    Guaranteed idempotency: The event's own idempotency_key (user:date:midnight_eval)
    prevents duplicate runs. Each cascading emit has its own unique key, preventing
    double Ghost Penalties or double shield generation on cron retries.

    Payload fields:
        local_date (str) The player's local date being evaluated "YYYY-MM-DD".
    """
    from ..repos.profile_repo import ProfileRepository
    from ..repos.event_repo import EventRepository
    from ..repos.inventory_repo import InventoryRepository

    profile_repo = ProfileRepository(ctx.db)
    event_repo = EventRepository(ctx.db)
    inventory_repo = InventoryRepository(ctx.db)

    local_date_str: str = ctx.payload.get("local_date", "")
    try:
        local_date = date.fromisoformat(local_date_str)
    except ValueError:
        logger.error(
            "MIDNIGHT_EVALUATION_STARTED: invalid local_date='%s' for user=%s — aborting.",
            local_date_str, ctx.user_id,
        )
        return

    profile = await profile_repo.get_profile(ctx.user_id)
    if not profile:
        logger.warning(
            "MIDNIGHT_EVALUATION_STARTED: profile not found for user=%s — skipping.",
            ctx.user_id,
        )
        return

    active_path: str = profile.get("active_path", "UNASSIGNED")
    daily_survival = await profile_repo.get_daily_survival(ctx.user_id)
    current_status: str = daily_survival.get("status", "PENDING") if daily_survival else "PENDING"

    # ── 1. Ghost Penalty check ────────────────────────────────────────────────
    if current_status == "PENDING":
        idem_key = event_repo.build_idempotency_key(
            ctx.user_id, local_date_str, "ghost_penalty"
        )
        await ctx.bus.emit(
            user_id=ctx.user_id,
            event_type="GHOST_PENALTY_APPLIED",
            source="SYSTEM",
            severity="WARNING",
            idempotency_key=idem_key,
            payload={
                "active_path": active_path,
                "local_date": local_date_str,
            },
        )

    # ── 2. Clean-day streak check ─────────────────────────────────────────────
    if current_status in ("SAFE_LOGGED", "SAFE_CLAIMED"):
        overspend_today = await event_repo.get_events_by_type_for_user_on_date(
            ctx.user_id, "OVERSPEND_DETECTED", local_date_str
        )
        is_clean_day = len(overspend_today) == 0

        if is_clean_day:
            streak = await profile_repo.increment_consecutive_clean_days(ctx.user_id)
            logger.debug(
                "Clean day streak: user=%s streak=%d", ctx.user_id, streak
            )
            if streak >= 7:
                current_shield_count = await inventory_repo.count_active_shields(ctx.user_id)
                shield_cap = inventory_repo.get_shield_cap_for_path(active_path)

                if current_shield_count < shield_cap:
                    idem_key = event_repo.build_idempotency_key(
                        ctx.user_id, local_date_str, "shield_generated",
                        suffix=str(streak),
                    )
                    await ctx.bus.emit(
                        user_id=ctx.user_id,
                        event_type="SHIELD_GENERATED",
                        source="SYSTEM",
                        severity="SUCCESS",
                        idempotency_key=idem_key,
                        payload={"streak_count": streak},
                    )
                    await profile_repo.reset_consecutive_clean_days(ctx.user_id)
                else:
                    logger.info(
                        "Shield cap (%d) reached for user=%s path=%s — streak not reset.",
                        shield_cap, ctx.user_id, active_path,
                    )
        else:
            await profile_repo.reset_consecutive_clean_days(ctx.user_id)
    else:
        # Ghost Penalty day counts as a broken streak.
        await profile_repo.reset_consecutive_clean_days(ctx.user_id)

    # ── 3. Quarterly Challenge evaluation ─────────────────────────────────────
    challenge = await profile_repo.get_active_challenge(ctx.user_id)
    if challenge and challenge.get("status") == "ACTIVE":
        try:
            ends_at = datetime.fromisoformat(
                challenge["ends_at"].replace("Z", "+00:00")
            )
            if _now_utc() >= ends_at:
                won = _evaluate_challenge_win_conditions(
                    challenge.get("progress_data", {})
                )
                result_event = "QUARTER_COMPLETED" if won else "QUARTER_FAILED"
                result_severity = "SUCCESS" if won else "WARNING"
                idem_key = event_repo.build_idempotency_key(
                    ctx.user_id, local_date_str,
                    result_event.lower(),
                    suffix=challenge["id"][:8],
                )
                await ctx.bus.emit(
                    user_id=ctx.user_id,
                    event_type=result_event,
                    source="ENGINE",
                    severity=result_severity,
                    idempotency_key=idem_key,
                    payload={
                        "challenge_id": challenge["id"],
                        "template_id": challenge.get("template_id", ""),
                        "won": won,
                    },
                )
        except (ValueError, KeyError, TypeError) as exc:
            logger.warning(
                "MIDNIGHT_EVALUATION_STARTED: challenge date parse failed "
                "for user=%s challenge=%s — %s",
                ctx.user_id, challenge.get("id"), exc,
            )

    # ── 4. Region shift check ─────────────────────────────────────────────────
    region = await profile_repo.get_current_region(ctx.user_id)
    if region and region.get("status") == "CURRENT":
        try:
            ends_at = datetime.fromisoformat(
                region["ends_at"].replace("Z", "+00:00")
            )
            if _now_utc() >= ends_at:
                idem_key = event_repo.build_idempotency_key(
                    ctx.user_id, local_date_str, "region_shift_pending",
                    suffix=region["id"][:8],
                )
                await ctx.bus.emit(
                    user_id=ctx.user_id,
                    event_type="REGION_SHIFT_PENDING",
                    source="SYSTEM",
                    severity="INFO",
                    idempotency_key=idem_key,
                    payload={
                        "current_region_id": region.get("region_id", ""),
                        "region_row_id": region["id"],
                        "local_date": local_date_str,
                    },
                )
        except (ValueError, KeyError, TypeError) as exc:
            logger.warning(
                "MIDNIGHT_EVALUATION_STARTED: region date parse failed "
                "for user=%s region=%s — %s",
                ctx.user_id, region.get("id"), exc,
            )

    # ── 5. Advance survival row + pre-create next day XP record ──────────────
    next_day = local_date + timedelta(days=1)
    await profile_repo.advance_daily_survival_to_date(ctx.user_id, next_day)
    await profile_repo.mark_evaluated(ctx.user_id, local_date)
    await profile_repo.ensure_daily_xp_record(ctx.user_id, next_day)

    logger.info(
        "MIDNIGHT_EVALUATION_STARTED: completed for user=%s local_date=%s",
        ctx.user_id, local_date_str,
    )


@on("GHOST_PENALTY_APPLIED")
async def handle_ghost_penalty_applied(ctx: "EventContext") -> None:
    """
    Applies the Ghost Penalty to a user with no daily activity.

    Resolution order (journey_game_rules.md §1.2):
      1. If Standby Token active → emit STANDBY_USED, skip HP damage.
      2. Else → emit HP_CHANGED (-10 base, -5 for PHANTOM path).
         Note: skip_shield=True — Shields do NOT block Ghost Penalties.

    Publish: Journal, Notification (HAZARD)

    Payload fields:
        active_path (str) Current path of the player.
        local_date  (str) Player's local date "YYYY-MM-DD".
    """
    from ..repos.inventory_repo import InventoryRepository
    from ..repos.event_repo import EventRepository

    inventory_repo = InventoryRepository(ctx.db)
    event_repo = EventRepository(ctx.db)

    active_path: str = ctx.payload.get("active_path", "UNASSIGNED")
    local_date: str = ctx.payload.get("local_date", _today_iso())

    # ── Standby check ─────────────────────────────────────────────────────────
    if await inventory_repo.is_standby_active(ctx.user_id):
        idem_key = event_repo.build_idempotency_key(
            ctx.user_id, local_date, "standby_used_ghost_block"
        )
        await ctx.bus.emit(
            user_id=ctx.user_id,
            event_type="STANDBY_USED",
            source="SYSTEM",
            severity="INFO",
            idempotency_key=idem_key,
            payload={"reason": "GHOST_PENALTY_BLOCKED", "local_date": local_date},
        )
        await _write_journal(
            ctx,
            "Ghost Penalty blocked — Standby Token consumed.",
            "INFO",
        )
        return

    # ── HP damage (shields skipped per spec) ─────────────────────────────────
    base_damage = _GHOST_PENALTY_DAMAGE.get(active_path, _GHOST_PENALTY_DAMAGE["_default"])
    await _emit_hp_changed(
        ctx, -base_damage, "GHOST_PENALTY", local_date,
        skip_shield=True,
    )

    await _write_journal(
        ctx,
        f"Ghost Penalty applied: -{base_damage} HP. Log a transaction or claim "
        f"Zero-Spend daily to avoid this.",
        "WARNING",
    )
    await _write_notification(
        ctx,
        category="HAZARD",
        severity="WARNING",
        title="Ghost Penalty",
        message=f"No activity logged yesterday. -{base_damage} HP deducted.",
        action_type="navigate_to_dashboard",
    )


@on("SHIELD_GENERATED")
async def handle_shield_generated(ctx: "EventContext") -> None:
    """
    Creates a Defense Shield after 7 consecutive clean-spend days.
    Delegates inventory mutation to InventoryRepository.create_shield().

    Publish: Journal, Notification (INVENTORY)

    Payload fields:
        streak_count (int) The streak count that triggered generation (≥ 7).
    """
    from ..repos.inventory_repo import InventoryRepository

    inventory_repo = InventoryRepository(ctx.db)
    streak_count: int = ctx.payload.get("streak_count", 7)

    await inventory_repo.create_shield(
        ctx.user_id, source_event_id=ctx.event_id
    )

    await _write_journal(
        ctx,
        (
            f"Defense Shield earned after {streak_count} consecutive clean days. "
            f"Shield active for 14 days."
        ),
        "SUCCESS",
    )
    await _write_notification(
        ctx,
        category="INVENTORY",
        severity="SUCCESS",
        title="Defense Shield Earned",
        message=(
            f"{streak_count} clean days — a new shield protects your HP for 14 days."
        ),
        action_type="open_inventory",
    )


@on("SHIELD_EXPIRED")
async def handle_shield_expired(ctx: "EventContext") -> None:
    """
    Records the expiry of a Defense Shield (triggered by Daily Janitor).
    The status update (AVAILABLE → EXPIRED) is performed by
    InventoryRepository.expire_overdue_shields() in bulk before this event fires.

    Publish: Journal
    """
    await _write_journal(
        ctx,
        "A Defense Shield expired before it was used.",
        "INFO",
    )


@on("STANDBY_USED")
async def handle_standby_used(ctx: "EventContext") -> None:
    """
    Marks the active Standby Token as USED after it blocked a Ghost Penalty.
    The token was activated earlier (status=ACTIVE). This handler performs the
    final status transition to USED and writes the audit trail.

    Publish: Journal

    Payload fields:
        reason     (str) Why the token was consumed, e.g. "GHOST_PENALTY_BLOCKED".
        local_date (str) Player's local date "YYYY-MM-DD".
    """
    from ..repos.inventory_repo import InventoryRepository

    inventory_repo = InventoryRepository(ctx.db)
    reason: str = ctx.payload.get("reason", "GHOST_PENALTY_BLOCKED")

    # Transition the currently ACTIVE token to USED.
    active_token = await inventory_repo.get_active_standby(ctx.user_id)
    if active_token:
        await ctx.db.table("journey_inventory").update(
            {"status": "USED"}
        ).eq("id", active_token["id"]).execute()
        logger.info(
            "STANDBY_USED: token=%s consumed for user=%s reason=%s",
            active_token["id"], ctx.user_id, reason,
        )

    await _write_journal(
        ctx,
        f"Standby Token consumed ({reason}). Ghost Penalty was blocked.",
        "INFO",
    )


@on("CHALLENGE_STARTED")
async def handle_challenge_started(ctx: "EventContext") -> None:
    """
    Records the start of a new 90-day quarterly challenge cycle.

    Publish: Journal, Notification (CHALLENGE)

    Payload fields:
        template_id    (str) The adventure template identifier.
        days_available (int) Days in the challenge window (always 90).
    """
    template_id: str = ctx.payload.get("template_id", "")
    days_available: int = ctx.payload.get("days_available", 90)

    await _write_journal(
        ctx,
        f"New 90-day challenge started: '{template_id}'. "
        f"{days_available} days to complete your objectives.",
        "INFO",
    )
    await _write_notification(
        ctx,
        category="CHALLENGE",
        severity="INFO",
        title="New Challenge Unlocked",
        message=f"A new {days_available}-day challenge has begun. Check your objectives.",
        action_type="open_challenge",
    )


@on("QUARTER_FAILED")
async def handle_quarter_failed(ctx: "EventContext") -> None:
    """
    Records a failed quarterly challenge.
    No HP damage — only the opportunity for rewards is lost (spec §5.1).
    Transitions challenge status to FAILED.

    Publish: Journal, Notification (CHALLENGE)

    Payload fields:
        challenge_id (str) UUID of the failed challenge.
    """
    from ..repos.profile_repo import ProfileRepository

    profile_repo = ProfileRepository(ctx.db)
    challenge_id: str = ctx.payload.get("challenge_id", "")

    if challenge_id:
        await profile_repo.update_challenge_status(challenge_id, "FAILED")

    await _write_journal(
        ctx,
        "Quarterly challenge ended — objectives not met. No rewards granted.",
        "WARNING",
    )
    await _write_notification(
        ctx,
        category="CHALLENGE",
        severity="WARNING",
        title="Challenge Failed",
        message="The 90-day challenge ended without meeting all objectives.",
        action_type="view_challenge_history",
    )


@on("REGION_SHIFT_PENDING")
async def handle_region_shift_pending(ctx: "EventContext") -> None:
    """
    Initiates the 365-day annual Region Shift sequence.
    Transitions the current region row to SHIFT_PENDING, then immediately
    emits REGION_SHIFT_COMPLETED to process rewards and advance the region.

    Full chain:
      REGION_SHIFT_PENDING → emit REGION_SHIFT_COMPLETED

    Payload fields:
        current_region_id (str) Region identifier of the ending region.
        region_row_id     (str) UUID of the ending region row (journey_regions).
        local_date        (str) Player's local date "YYYY-MM-DD".
    """
    from ..repos.profile_repo import ProfileRepository
    from ..repos.event_repo import EventRepository

    profile_repo = ProfileRepository(ctx.db)
    event_repo = EventRepository(ctx.db)

    region_row_id: str = ctx.payload.get("region_row_id", "")
    current_region_id: str = ctx.payload.get("current_region_id", "")
    local_date: str = ctx.payload.get("local_date", _today_iso())

    # Transition current region to SHIFT_PENDING before the completion event fires.
    if region_row_id:
        await profile_repo.update_region_status(region_row_id, "SHIFT_PENDING")

    idem_key = event_repo.build_idempotency_key(
        ctx.user_id, local_date, "region_shift_completed",
        suffix=region_row_id[:8] if region_row_id else "x",
    )
    await ctx.bus.emit(
        user_id=ctx.user_id,
        event_type="REGION_SHIFT_COMPLETED",
        source="SYSTEM",
        severity="SUCCESS",
        idempotency_key=idem_key,
        payload={
            "previous_region_id": current_region_id,
            "next_region_id": _next_region_id(current_region_id),
            "region_row_id": region_row_id,
            "local_date": local_date,
        },
    )


@on("REGION_SHIFT_COMPLETED")
async def handle_region_shift_completed(ctx: "EventContext") -> None:
    """
    Completes the annual Region Shift and grants all associated rewards.

    Full chain:
      REGION_SHIFT_COMPLETED
        ├─ Transition old region row → SHIFTED
        ├─ Create new CURRENT region row (365-day window)
        ├─ emit XP_CHANGED (+1000)
        ├─ Refill Standby Tokens to max (7)
        └─ emit PASSPORT_STAMP_EARNED

    Publish: Journal, Notification (REGION)

    Payload fields:
        previous_region_id (str) Region identifier being left.
        next_region_id     (str) Region identifier being entered.
        region_row_id      (str) UUID of the old region row.
        local_date         (str) Player's local date "YYYY-MM-DD".
    """
    from ..repos.profile_repo import ProfileRepository
    from ..repos.inventory_repo import InventoryRepository
    from ..repos.event_repo import EventRepository

    profile_repo = ProfileRepository(ctx.db)
    inventory_repo = InventoryRepository(ctx.db)
    event_repo = EventRepository(ctx.db)

    previous_region: str = ctx.payload.get("previous_region_id", "unknown")
    next_region: str = ctx.payload.get("next_region_id", _REGION_SEQUENCE[0])
    region_row_id: str = ctx.payload.get("region_row_id", "")
    local_date: str = ctx.payload.get("local_date", _today_iso())
    now = _now_utc()

    # ── 1. Finalize old region row ────────────────────────────────────────────
    if region_row_id:
        await profile_repo.update_region_status(region_row_id, "SHIFTED")

    # ── 2. Create new CURRENT region row ─────────────────────────────────────
    await profile_repo.create_new_region(
        user_id=ctx.user_id,
        region_id=next_region,
        started_at=now,
        ends_at=now + timedelta(days=365),
    )

    # ── 3. Grant 1000 XP for completing a full year ───────────────────────────
    await _emit_xp_changed(ctx, 1000, "REGION_SHIFT_COMPLETED", local_date)

    # ── 4. Refill Standby Tokens to annual allotment ─────────────────────────
    await inventory_repo.refill_standby_tokens(
        ctx.user_id, source_event_id=ctx.event_id
    )

    # ── 5. Earn Passport Stamp ───────────────────────────────────────────────
    idem_key = event_repo.build_idempotency_key(
        ctx.user_id, local_date, "passport_stamp", suffix=previous_region
    )
    await ctx.bus.emit(
        user_id=ctx.user_id,
        event_type="PASSPORT_STAMP_EARNED",
        source="ENGINE",
        severity="SUCCESS",
        idempotency_key=idem_key,
        payload={
            "region_id": previous_region,
            "completed_at": now.isoformat(),
        },
    )

    # ── 6. Journal + Notification ─────────────────────────────────────────────
    previous_label = previous_region.replace("_", " ").title()
    next_label = next_region.replace("_", " ").title()

    await _write_journal(
        ctx,
        (
            f"Region shift complete: {previous_label} → {next_label}. "
            f"+1000 XP awarded. Standby Tokens refilled to 7."
        ),
        "SUCCESS",
    )
    await _write_notification(
        ctx,
        category="REGION",
        severity="SUCCESS",
        title="New Region Reached",
        message=(
            f"A full year in {previous_label} complete. "
            f"Welcome to {next_label}. +1000 XP, tokens refilled."
        ),
        action_type="open_passport",
    )


# ===========================================================================
# ── ENGINE EVENT HANDLERS ───────────────────────────────────────────────────
# ===========================================================================


@on("XP_CHANGED")
async def handle_xp_changed(ctx: "EventContext") -> None:
    """
    Applies an XP delta to the player's total and checks for level-up.

    The XP cap enforcement happens upstream (in EXPENSE_LOGGED, INCOME_LOGGED,
    ZERO_SPEND_CLAIMED handlers) via journey_daily_xp. By the time this handler
    runs, the delta is authoritative and should be applied unconditionally.

    Full chain:
      XP_CHANGED
        └─ [For each level crossed] emit LEVEL_UP

    Payload fields:
        delta        (int) XP change. Positive = gain, negative = revocation.
        source_event (str) Origin event type for logging, e.g. "EXPENSE_LOGGED".
    """
    from ..repos.profile_repo import ProfileRepository
    from ..repos.event_repo import EventRepository

    profile_repo = ProfileRepository(ctx.db)
    event_repo = EventRepository(ctx.db)

    delta: int = ctx.payload.get("delta", 0)
    source_event: str = ctx.payload.get("source_event", "UNKNOWN")

    if delta == 0:
        return

    profile = await profile_repo.get_profile(ctx.user_id)
    if not profile:
        logger.error("XP_CHANGED: profile not found for user=%s", ctx.user_id)
        return

    old_xp: int = profile.get("total_xp", 0)
    old_level: int = profile.get("current_level", 1)
    new_xp: int = max(0, old_xp + delta)
    new_level: int = _level_from_xp(new_xp)

    await profile_repo.update_xp_and_level(ctx.user_id, new_xp, new_level)

    logger.info(
        "XP_CHANGED: user=%s delta=%+d xp=%d→%d level=%d→%d source=%s",
        ctx.user_id, delta, old_xp, new_xp, old_level, new_level, source_event,
    )

    # ── Level-up cascade (handles multi-level jumps) ──────────────────────────
    if new_level > old_level:
        local_date = _today_iso()
        for reached_level in range(old_level + 1, new_level + 1):
            idem_key = event_repo.build_idempotency_key(
                ctx.user_id, local_date, "level_up", suffix=str(reached_level)
            )
            await ctx.bus.emit(
                user_id=ctx.user_id,
                event_type="LEVEL_UP",
                source="ENGINE",
                severity="SUCCESS",
                idempotency_key=idem_key,
                payload={
                    "old_level": reached_level - 1,
                    "new_level": reached_level,
                    "total_xp": new_xp,
                },
            )


@on("HP_CHANGED")
async def handle_hp_changed(ctx: "EventContext") -> None:
    """
    Applies an HP delta, resolving Defense Shields for damage events,
    and triggers HP_CRITICAL_FAILURE if HP reaches 0.

    Shield resolution rules (journey_game_rules.md §2.1):
      - Shields only block damage (delta < 0).
      - payload.skip_shield=True bypasses shield resolution entirely.
        (Used by Ghost Penalty — spec explicitly states shields don't block it.)
      - One shield absorbs the entire damage from a single event (delta → 0).
      - Shield destruction is recorded via SHIELD_DESTROYED cascade.

    HP is clamped: max(0, min(100, old_hp + delta)).

    Full chain:
      HP_CHANGED
        ├─ [Damage + shield available + skip_shield=False]
        │    emit SHIELD_DESTROYED, return (no HP change)
        └─ [HP hits 0] emit HP_CRITICAL_FAILURE

    Payload fields:
        delta                    (int)  HP change. Negative = damage.
        source_event             (str)  Origin event for logging.
        skip_shield              (bool) If True, bypasses shield resolution.
        override_critical_failure(bool) If True, allows HP change even when
                                        vitality is CRITICAL_FAILURE (for Audit).
    """
    from ..repos.profile_repo import ProfileRepository
    from ..repos.inventory_repo import InventoryRepository
    from ..repos.event_repo import EventRepository

    profile_repo = ProfileRepository(ctx.db)
    inventory_repo = InventoryRepository(ctx.db)
    event_repo = EventRepository(ctx.db)

    delta: int = ctx.payload.get("delta", 0)
    source_event: str = ctx.payload.get("source_event", "UNKNOWN")
    skip_shield: bool = ctx.payload.get("skip_shield", False)
    local_date: str = _today_iso()

    if delta == 0:
        return

    profile = await profile_repo.get_profile(ctx.user_id)
    if not profile:
        logger.error("HP_CHANGED: profile not found for user=%s", ctx.user_id)
        return

    old_hp: int = profile.get("current_hp", 100)

    # ── Shield resolution (damage events only) ────────────────────────────────
    if delta < 0 and not skip_shield:
        has_shield = await inventory_repo.has_active_shield(ctx.user_id)
        if has_shield:
            destroyed = await inventory_repo.destroy_oldest_shield(ctx.user_id)
            if destroyed:
                idem_key = event_repo.build_idempotency_key(
                    ctx.user_id, local_date, "shield_destroyed",
                    suffix=destroyed["id"][:8],
                )
                await ctx.bus.emit(
                    user_id=ctx.user_id,
                    event_type="SHIELD_DESTROYED",
                    source="ENGINE",
                    severity="WARNING",
                    idempotency_key=idem_key,
                    payload={
                        "shield_id": destroyed["id"],
                        "damage_blocked": abs(delta),
                        "source_event": source_event,
                    },
                )
                logger.info(
                    "HP_CHANGED: shield absorbed %d damage for user=%s.",
                    abs(delta), ctx.user_id,
                )
                return  # Shield consumed — no HP mutation.

    # ── Apply delta ───────────────────────────────────────────────────────────
    new_hp = max(0, min(100, old_hp + delta))
    new_vitality = _vitality_from_hp(new_hp)

    await profile_repo.update_hp_and_vitality(ctx.user_id, new_hp, new_vitality)

    logger.info(
        "HP_CHANGED: user=%s delta=%+d hp=%d→%d vitality=%s source=%s",
        ctx.user_id, delta, old_hp, new_hp, new_vitality, source_event,
    )

    # ── Critical Failure gate ─────────────────────────────────────────────────
    if new_hp == 0:
        idem_key = event_repo.build_idempotency_key(
            ctx.user_id, local_date, "hp_critical_failure"
        )
        await ctx.bus.emit(
            user_id=ctx.user_id,
            event_type="HP_CRITICAL_FAILURE",
            source="ENGINE",
            severity="DANGER",
            idempotency_key=idem_key,
            payload={"final_hp": 0, "source_event": source_event},
        )


@on("OVERSPEND_DETECTED")
async def handle_overspend_detected(ctx: "EventContext") -> None:
    """
    Routes an overspend event through the Damage Resolution Engine.

    Formula (logic.md):
      Overspend Ratio R = max(0, variance) / daily_budget
      HP Loss = min(round(R × 20), 30)  — capped at 30 per day

    Emits HP_CHANGED with skip_shield=False — shields DO absorb overspend damage.

    Payload fields:
        variance            (int) Amount spent over daily budget.
        daily_budget        (int) The player's safe daily budget. Avoid division by zero.
        source_transaction_id (str) Transaction UUID for idempotency suffix.
        local_date          (str) Player's local date "YYYY-MM-DD".
    """
    from ..repos.event_repo import EventRepository

    event_repo = EventRepository(ctx.db)

    variance: int = ctx.payload.get("variance", 0)
    daily_budget: int = max(1, ctx.payload.get("daily_budget", 1))
    source_transaction_id: str = ctx.payload.get("source_transaction_id", "")
    local_date: str = ctx.payload.get("local_date", _today_iso())

    overspend_ratio = max(0, variance) / daily_budget
    base_damage = min(round(overspend_ratio * 20), 30)

    if base_damage <= 0:
        logger.info(
            "OVERSPEND_DETECTED: zero damage computed for user=%s "
            "variance=%d budget=%d — no HP event emitted.",
            ctx.user_id, variance, daily_budget,
        )
        return

    idem_key = event_repo.build_idempotency_key(
        ctx.user_id, local_date, "overspend_hp_damage",
        suffix=source_transaction_id[:8] if source_transaction_id else "x",
    )
    await ctx.bus.emit(
        user_id=ctx.user_id,
        event_type="HP_CHANGED",
        source="ENGINE",
        severity="WARNING",
        idempotency_key=idem_key,
        payload={
            "delta": -base_damage,
            "source_event": "OVERSPEND_DETECTED",
            "skip_shield": False,
            "variance": variance,
        },
    )


@on("SHIELD_DESTROYED")
async def handle_shield_destroyed(ctx: "EventContext") -> None:
    """
    Records a shield destruction event.
    The physical inventory mutation (AVAILABLE → DESTROYED) is performed by
    InventoryRepository.destroy_oldest_shield() inside handle_hp_changed
    before this event is emitted.

    Publish: Journal, Notification (INVENTORY)

    Payload fields:
        shield_id     (str) UUID of the destroyed shield.
        damage_blocked(int) HP damage the shield absorbed.
        source_event  (str) The event that triggered the damage.
    """
    damage_blocked: int = ctx.payload.get("damage_blocked", 0)
    source_event: str = ctx.payload.get("source_event", "UNKNOWN")
    source_label = source_event.replace("_", " ").lower()

    await _write_journal(
        ctx,
        f"Defense Shield destroyed — blocked {damage_blocked} HP damage from {source_label}.",
        "WARNING",
    )
    await _write_notification(
        ctx,
        category="INVENTORY",
        severity="WARNING",
        title="Shield Destroyed",
        message=(
            f"A Defense Shield absorbed {damage_blocked} HP damage. "
            f"Earn more by staying under budget for 7 consecutive days."
        ),
        action_type="open_inventory",
    )


@on("LEVEL_UP")
async def handle_level_up(ctx: "EventContext") -> None:
    """
    Processes a level-up transition and emits FEATURE_UNLOCKED for each
    feature registered at the new level in LEVEL_UNLOCK_REGISTRY.

    Full chain:
      LEVEL_UP
        └─ [For each feature_key at new_level] emit FEATURE_UNLOCKED

    Publish: Journal, Notification (ACHIEVEMENT)

    Payload fields:
        old_level (int) Level before the XP gain.
        new_level (int) Level after the XP gain.
        total_xp  (int) New total XP for display.
    """
    from ..repos.event_repo import EventRepository

    event_repo = EventRepository(ctx.db)

    new_level: int = ctx.payload.get("new_level", 1)
    old_level: int = ctx.payload.get("old_level", new_level - 1)
    local_date: str = _today_iso()

    await _write_journal(
        ctx,
        f"Level Up! Advanced from Level {old_level} to Level {new_level}.",
        "SUCCESS",
    )
    await _write_notification(
        ctx,
        category="ACHIEVEMENT",
        severity="SUCCESS",
        title=f"Level {new_level} Reached",
        message=f"You advanced from Level {old_level} to Level {new_level}.",
        action_type="open_profile",
    )

    # ── Emit feature unlocks for this level ───────────────────────────────────
    for feature_key in LEVEL_UNLOCK_REGISTRY.get(new_level, []):
        idem_key = event_repo.build_idempotency_key(
            ctx.user_id, local_date, "feature_unlocked",
            suffix=f"lv{new_level}_{feature_key}",
        )
        await ctx.bus.emit(
            user_id=ctx.user_id,
            event_type="FEATURE_UNLOCKED",
            source="ENGINE",
            severity="SUCCESS",
            idempotency_key=idem_key,
            payload={"level": new_level, "feature_key": feature_key},
        )


@on("FEATURE_UNLOCKED")
async def handle_feature_unlocked(ctx: "EventContext") -> None:
    """
    Persists a feature unlock to journey_unlock_events so it surfaces in
    the bootstrap payload's pending_unlocks list until the client acknowledges it.

    Publish: Journal, Notification (ACHIEVEMENT), persist unlock record.

    Payload fields:
        level       (int) Level at which the feature was unlocked.
        feature_key (str) Machine-readable feature identifier.
    """
    from ..repos.profile_repo import ProfileRepository

    profile_repo = ProfileRepository(ctx.db)

    level: int = ctx.payload.get("level", 1)
    feature_key: str = ctx.payload.get("feature_key", "")
    feature_label = _FEATURE_LABELS.get(
        feature_key, feature_key.replace("_", " ").title()
    )

    await profile_repo.insert_unlock_event(ctx.user_id, level, feature_key)

    await _write_journal(
        ctx,
        f"Feature unlocked at Level {level}: {feature_label}.",
        "SUCCESS",
    )
    await _write_notification(
        ctx,
        category="ACHIEVEMENT",
        severity="SUCCESS",
        title=f"Unlocked: {feature_label}",
        message=f"Reached Level {level} — {feature_label} is now available.",
        action_type="open_feature_modal",
        action_payload={"feature_key": feature_key, "level": level},
    )


@on("HP_CRITICAL_FAILURE")
async def handle_hp_critical_failure(ctx: "EventContext") -> None:
    """
    Locks the player's account when HP reaches 0.
    The profile's HP and vitality are already set to 0 / CRITICAL_FAILURE
    by handle_hp_changed before this event fires. This handler ensures the
    DB state is authoritative and writes the user-facing audit trail.

    CF-locked endpoints (journey_state_machine.md §1 Restrictions):
      POST /claim/zero-spend, POST /standby/use
    These return 403 CRITICAL_FAILURE_ACTIVE while vitality == CRITICAL_FAILURE.
    Recovery: POST /revive → FINANCIAL_AUDIT_COMPLETED → HP_CHANGED(+10).

    Publish: Journal (DANGER), Notification (HAZARD: "Account Locked")

    Payload fields:
        source_event (str) The event that caused HP to reach 0.
    """
    from ..repos.profile_repo import ProfileRepository

    profile_repo = ProfileRepository(ctx.db)
    source_event: str = ctx.payload.get("source_event", "UNKNOWN")

    # Re-affirm the CRITICAL_FAILURE state. HP_CHANGED already wrote 0/CRITICAL_FAILURE,
    # but we confirm here in case of any race between cascading events.
    await profile_repo.update_hp_and_vitality(
        ctx.user_id, new_hp=0, vitality="CRITICAL_FAILURE"
    )

    await _write_journal(
        ctx,
        (
            f"CRITICAL FAILURE — HP reached 0 from {source_event.replace('_', ' ').lower()}. "
            f"Complete the Financial Audit to restore account access."
        ),
        "DANGER",
    )
    await _write_notification(
        ctx,
        category="HAZARD",
        severity="DANGER",
        title="Account Locked",
        message=(
            "HP has reached 0. Your account is locked. "
            "Complete the Financial Audit to recover."
        ),
        action_type="navigate_to_audit",
    )


@on("QUARTER_COMPLETED")
async def handle_quarter_completed(ctx: "EventContext") -> None:
    """
    Records a successful quarterly challenge completion.
    Rewards are NOT granted automatically — the player must explicitly claim them
    via POST /rewards/claim. The challenge status is set to COMPLETED to surface
    the claim CTA in the bootstrap payload.

    Publish: Journal, Notification (CHALLENGE: "Quarter Victory")

    Payload fields:
        challenge_id (str) UUID of the completed challenge.
    """
    from ..repos.profile_repo import ProfileRepository

    profile_repo = ProfileRepository(ctx.db)
    challenge_id: str = ctx.payload.get("challenge_id", "")

    if challenge_id:
        await profile_repo.update_challenge_status(challenge_id, "COMPLETED")

    await _write_journal(
        ctx,
        "Quarterly challenge complete — all objectives met! Claim your rewards from the dashboard.",
        "SUCCESS",
    )
    await _write_notification(
        ctx,
        category="CHALLENGE",
        severity="SUCCESS",
        title="Quarter Victory",
        message="All objectives met. Claim your XP and HP rewards now.",
        action_type="claim_challenge_rewards",
        action_payload={"challenge_id": challenge_id},
    )


@on("PASSPORT_STAMP_EARNED")
async def handle_passport_stamp_earned(ctx: "EventContext") -> None:
    """
    Records the earning of a Passport Stamp after completing a full year in a region.
    Stamps are stored in journey_events (this event) and surfaced in the Passport UI
    by querying PASSPORT_STAMP_EARNED events for the user.

    Publish: Journal, Notification (ACHIEVEMENT)

    Payload fields:
        region_id    (str) The region that was completed.
        completed_at (str) ISO-8601 timestamp of completion.
    """
    region_id: str = ctx.payload.get("region_id", "unknown")
    region_label = region_id.replace("_", " ").title()

    await _write_journal(
        ctx,
        f"Passport stamp earned: '{region_label}' completed after a full year.",
        "SUCCESS",
    )
    await _write_notification(
        ctx,
        category="ACHIEVEMENT",
        severity="SUCCESS",
        title="Passport Stamp Earned",
        message=(
            f"A full year in {region_label} is complete. "
            f"The stamp has been added to your journey passport."
        ),
        action_type="open_passport",
    )

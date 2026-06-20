"""
src/backend/journey/router.py

FastAPI APIRouter for the Journey Engine.

Base URL: /api/v1/journey  (registered in the root FastAPI app)
Auth:      All user-facing routes require a valid Supabase JWT via
           Authorization: Bearer <token> — enforced by CurrentUserID dependency.
Format:    JSON — all responses follow the standard envelope:
           {"success": true, "data": {...}} or {"success": false, "error": {...}}

Endpoint index:
  GET  /bootstrap                 — full dashboard hydration
  POST /claim/zero-spend    🔒    — claim zero-spend day (+XP, ghost protection)
  POST /standby/use         🔒    — activate standby token (24h ghost freeze)
  POST /path/change               — switch player path (6-month cooldown)
  POST /revive                    — financial audit recovery from CRITICAL_FAILURE
  POST /rewards/claim             — claim quarterly challenge rewards
  POST /unlocks/{id}/acknowledge  — dismiss level-up feature unlock modal
  GET  /challenges/history        — paginated ARCHIVED challenge list
  GET  /journal                   — paginated journal entries
  GET  /notifications             — paginated notifications
  PATCH /notifications/{id}       — mark notification READ or ARCHIVED
  POST /cron/daily-evaluation     — QStash rolling midnight webhook (auth: HMAC)
  POST /cron/system-cleanup       — QStash daily janitor webhook (auth: HMAC)

CF-Locked (🔒) endpoints return HTTP 403 CRITICAL_FAILURE_ACTIVE when HP == 0.
Cron endpoints return 202 Accepted immediately; heavy work runs in BackgroundTasks.
"""
from __future__ import annotations

import logging
from typing import Annotated, Any
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse

from .dependencies import (
    BootstrapServiceDep,
    CFGuard,
    CronServiceDep,
    CurrentUserID,
    DBClient,
    HPServiceDep,
    InventoryServiceDep,
    QStashVerified,
    XPServiceDep,
    get_event_bus,
)
from .engine.bus import EventBus
from .schemas.requests import (
    CronDailyEvaluationRequest,
    CronSystemCleanupRequest,
    NotificationUpdateRequest,
    PathChangeRequest,
    RewardClaimRequest,
    ReviveRequest,
    StandbyUseRequest,
    ZeroSpendClaimRequest,
    WalletTransactionEventPayload,
)
from .schemas.responses import (
    BootstrapResponse,
    ErrorDetail,
    ErrorResponse,
    NotificationListResponse,
    PathChangeResponse,
    PlayerPathID,
    PendingUnlockResponse,
    RewardClaimResponse,
    ReviveResponse,
    StandbyUseResponse,
    SuccessResponse,
    ZeroSpendClaimResponse,
)
from .repos.event_repo import EventRepository
from .repos.profile_repo import ProfileRepository
from .services.cron_svc import CronService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/journey",
    tags=["Journey Engine"],
)

_today_iso = lambda: datetime.now(timezone.utc).date().isoformat()  # noqa: E731


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _success(data: dict[str, Any]) -> dict[str, Any]:
    return {"success": True, "data": data}


def _error(code: str, message: str) -> dict[str, Any]:
    return {"success": False, "error": {"code": code, "message": message}}


def _raise_400(code: str, message: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=_error(code, message),
    )


def _raise_403(code: str, message: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=_error(code, message),
    )


def _raise_404(code: str, message: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=_error(code, message),
    )


# ===========================================================================
# ── PRIMARY HYDRATION ───────────────────────────────────────────────────────
# ===========================================================================


@router.get(
    "/bootstrap",
    response_model=BootstrapResponse,
    summary="Dashboard hydration — full concurrent fetch",
)
async def get_bootstrap(
    user_id: CurrentUserID,
    bootstrap_svc: BootstrapServiceDep,
) -> BootstrapResponse:
    """
    Returns the consolidated dashboard payload via asyncio.gather.
    Called once after login and on each full page refresh.

    All sub-queries (profile, daily_survival, inventory, region, challenge,
    journal, notifications, unlocks) run concurrently in one round-trip.

    Returns HTTP 404 if the player has not completed onboarding.
    """
    try:
        return await bootstrap_svc.get_full_dashboard(user_id)
    except ValueError as exc:
        _raise_404("PROFILE_NOT_FOUND", str(exc))


# ===========================================================================
# ── CORE PLAYER ACTIONS ─────────────────────────────────────────────────────
# ===========================================================================


@router.post(
    "/claim/zero-spend",
    summary="🔒 CF-Locked — Claim a Zero-Spend day",
)
async def claim_zero_spend(
    _cf: CFGuard,
    user_id: CurrentUserID,
    db: DBClient,
    xp_svc: XPServiceDep,
    bus: Annotated[EventBus, Depends(get_event_bus)],
    _body: ZeroSpendClaimRequest = ZeroSpendClaimRequest(),
) -> dict[str, Any]:
    """
    Claims a Zero-Spend day for the current calendar day.

    Preconditions (validated server-side):
      - Player is not in CRITICAL_FAILURE (enforced by CFGuard).
      - No expense transaction has been logged today.
      - Zero-Spend has not already been claimed today.

    Effects:
      - Emits ZERO_SPEND_CLAIMED event → survival state transitions to SAFE_CLAIMED.
      - Grants XP via XPService.evaluate_xp_gain (+10, or +15 for PHANTOM path).

    Returns:
      Updated player_state and daily_status slices.
    """
    local_date = _today_iso()
    profile_repo = ProfileRepository(db)
    event_repo = EventRepository(db)

    # ── Pre-condition: no expenses logged today ───────────────────────────────
    daily_survival = await profile_repo.get_daily_survival(user_id)
    current_status = (daily_survival.get("status", "PENDING") if daily_survival else "PENDING")

    if current_status == "SAFE_LOGGED":
        _raise_400(
            "EXPENSE_ALREADY_LOGGED",
            "An expense has been logged today. Zero-Spend Day cannot be claimed.",
        )

    if current_status == "SAFE_CLAIMED":
        _raise_400(
            "ZERO_SPEND_ALREADY_CLAIMED",
            "Zero-Spend Day has already been claimed for today.",
        )

    # ── Emit ZERO_SPEND_CLAIMED event ─────────────────────────────────────────
    idem_key = event_repo.build_idempotency_key(user_id, local_date, "zero_spend_claimed")
    result = await bus.publish(
        user_id=user_id,
        event_type="ZERO_SPEND_CLAIMED",
        source="USER",
        severity="SUCCESS",
        idempotency_key=idem_key,
        payload={"local_date": local_date},
    )

    if result.get("is_duplicate"):
        _raise_400(
            "ZERO_SPEND_ALREADY_CLAIMED",
            "Zero-Spend Day has already been claimed for today.",
        )

    # ── Build response from refreshed profile ─────────────────────────────────
    from .services.bootstrap_svc import BootstrapService
    bootstrap_svc = BootstrapService(db)

    updated_profile = await profile_repo.get_profile(user_id)
    updated_survival = await profile_repo.get_daily_survival(user_id)
    inventory_summary = await profile_repo.get_profile(user_id)  # for standby

    from .services.inventory_svc import InventoryService
    from .repos.inventory_repo import InventoryRepository
    inv_repo = InventoryRepository(db)
    inv_summary = await inv_repo.get_inventory_summary(user_id)

    player_state = bootstrap_svc._build_player_state(updated_profile)
    daily_status = bootstrap_svc._build_daily_status(
        profile=updated_profile,
        daily_survival=updated_survival,
        inventory_summary=inv_summary,
    )

    return _success({
        "player_state": player_state.model_dump(),
        "daily_status": daily_status.model_dump(),
    })


@router.post(
    "/standby/use",
    summary="🔒 CF-Locked — Activate a Standby Token",
)
async def use_standby_token(
    _cf: CFGuard,
    user_id: CurrentUserID,
    db: DBClient,
    inv_svc: InventoryServiceDep,
    _body: StandbyUseRequest = StandbyUseRequest(),
) -> dict[str, Any]:
    """
    Activates a Standby Token to freeze Ghost Penalty for 24 hours.

    Preconditions:
      - Player is not in CRITICAL_FAILURE (CFGuard).
      - At least one AVAILABLE token exists.
      - No token is currently ACTIVE.

    Effects:
      - Oldest AVAILABLE token → ACTIVE, expires_at = now + 24h.
      - Emits STANDBY_ACTIVATED event (journal + notification).

    Returns:
      Updated inventory slice (standby_mode + active_shields).
    """
    local_date = _today_iso()

    try:
        result = await inv_svc.consume_standby_token(
            user_id=user_id,
            local_date=local_date,
        )
    except ValueError as exc:
        _raise_400("STANDBY_UNAVAILABLE", str(exc))

    inv_summary = await inv_svc.get_inventory_summary(user_id)

    from .services.bootstrap_svc import BootstrapService
    bootstrap_svc = BootstrapService(db)
    inventory_model = bootstrap_svc._build_inventory(inv_summary)

    return _success({"inventory": inventory_model.model_dump()})


@router.post(
    "/path/change",
    summary="Switch player progression path (6-month cooldown)",
)
async def change_path(
    user_id: CurrentUserID,
    db: DBClient,
    bus: Annotated[EventBus, Depends(get_event_bus)],
    body: PathChangeRequest,
) -> dict[str, Any]:
    """
    Changes the player's active progression path.

    Preconditions:
      - No active path cooldown (path_cooldown_until has passed).
      - new_path != "UNASSIGNED" (enforced by Pydantic validator).

    Effects:
      - Updates profile: active_path + path_cooldown_until = now + 6 months.
      - Emits PATH_CHANGED event (journal + notification).

    Returns:
      {"success": true, "new_path": "CATALYST", "cooldown_until": "iso8601"}
    """
    from datetime import timedelta

    profile_repo = ProfileRepository(db)
    event_repo = EventRepository(db)
    local_date = _today_iso()

    profile = await profile_repo.get_profile(user_id)
    if not profile:
        _raise_404("PROFILE_NOT_FOUND", "Player profile not found.")

    # ── Cooldown check ────────────────────────────────────────────────────────
    cooldown_str: str | None = profile.get("path_cooldown_until")
    if cooldown_str:
        try:
            cooldown_until = datetime.fromisoformat(
                cooldown_str.replace("Z", "+00:00")
            )
            if datetime.now(timezone.utc) < cooldown_until:
                _raise_403(
                    "PATH_CHANGE_COOLDOWN",
                    f"Path change is locked until {cooldown_until.isoformat()}. "
                    "Paths can only be changed once every 6 months.",
                )
        except ValueError:
            pass  # Malformed date — allow the change.

    # ── Apply path change ─────────────────────────────────────────────────────
    old_path: str = profile.get("active_path", "UNASSIGNED")
    new_path: str = body.new_path.value
    cooldown_until = datetime.now(timezone.utc) + timedelta(days=180)

    await profile_repo.set_path_and_cooldown(user_id, new_path, cooldown_until)

    # ── Emit PATH_CHANGED event ───────────────────────────────────────────────
    idem_key = event_repo.build_idempotency_key(
        user_id, local_date, "path_changed", suffix=new_path.lower()
    )
    await bus.publish(
        user_id=user_id,
        event_type="PATH_CHANGED",
        source="USER",
        severity="INFO",
        idempotency_key=idem_key,
        payload={
            "old_path": old_path,
            "new_path": new_path,
            "cooldown_until": cooldown_until.isoformat(),
        },
    )

    return _success({
        "new_path": new_path,
        "cooldown_until": cooldown_until.isoformat(),
    })


@router.post(
    "/revive",
    summary="Financial Audit — recover from CRITICAL_FAILURE",
)
async def revive(
    user_id: CurrentUserID,
    hp_svc: HPServiceDep,
    body: ReviveRequest,
) -> dict[str, Any]:
    """
    Executes the Financial Audit recovery flow.
    This is the ONLY way to exit CRITICAL_FAILURE state.

    Preconditions:
      - audit_acknowledged must be true (Pydantic validator enforces this).
      - Player must be in CRITICAL_FAILURE (vitality == "CRITICAL_FAILURE").

    Effects:
      - HP restored to 10.
      - vitality transitions: CRITICAL_FAILURE → HAZARD.
      - Emits FINANCIAL_AUDIT_COMPLETED (journal + "Account Restored" notification).

    Note:
      This endpoint is intentionally NOT CF-Locked so it remains accessible
      when the account is locked (journey_state_machine.md §1 Restrictions).

    Returns:
      Updated player_state with hp=10 and vitality=HAZARD.
    """
    local_date = _today_iso()
    heal_result = await hp_svc.execute_financial_audit(
        user_id=user_id,
        local_date=local_date,
    )

    return _success({
        "player_state": {
            "hp": heal_result.hp_after,
            "vitality": heal_result.vitality_after,
            "was_in_critical_failure": heal_result.was_in_critical_failure,
        }
    })


@router.post(
    "/rewards/claim",
    summary="Claim quarterly challenge rewards",
)
async def claim_rewards(
    user_id: CurrentUserID,
    db: DBClient,
    bus: Annotated[EventBus, Depends(get_event_bus)],
    body: RewardClaimRequest,
) -> dict[str, Any]:
    """
    Claims pending XP and HP rewards from a COMPLETED Quarterly Challenge.
    Rewards must be explicitly claimed — they are never auto-granted on completion.

    Preconditions:
      - Challenge belongs to the requesting user.
      - Challenge status == "COMPLETED".
      - rewards_claimed == False (not yet claimed).

    Effects:
      - Emits REWARD_CLAIMED event → XP_CHANGED + HP_CHANGED cascades.
      - Sets challenge.rewards_claimed = True.

    Returns:
      Updated player_state with new XP and HP values.
    """
    from .repos.event_repo import EventRepository

    profile_repo = ProfileRepository(db)
    event_repo = EventRepository(db)
    local_date = _today_iso()

    challenge_id = str(body.challenge_id)

    # ── Validate challenge ────────────────────────────────────────────────────
    challenge = await profile_repo.get_challenge_by_id(user_id, challenge_id)
    if not challenge:
        _raise_404("CHALLENGE_NOT_FOUND", f"Challenge {challenge_id} not found.")

    if challenge.get("status") != "COMPLETED":
        _raise_400(
            "CHALLENGE_NOT_COMPLETED",
            f"Challenge is in status '{challenge.get('status')}'. "
            "Only COMPLETED challenges have claimable rewards.",
        )

    if challenge.get("rewards_claimed", False):
        _raise_400(
            "REWARDS_ALREADY_CLAIMED",
            "Rewards for this challenge have already been claimed.",
        )

    # ── Rewards from template (hardcoded MVP values per spec §5.1) ─────────────
    XP_REWARD = 250
    HP_REWARD = 15

    # ── Mark rewards claimed before emitting (prevents double-claim on retry) ──
    await profile_repo.mark_challenge_rewards_claimed(challenge_id)

    # ── Emit REWARD_CLAIMED → XP_CHANGED + HP_CHANGED cascades ──────────────
    idem_key = event_repo.build_idempotency_key(
        user_id, local_date, "reward_claimed", suffix=challenge_id[:8]
    )
    await bus.publish(
        user_id=user_id,
        event_type="REWARD_CLAIMED",
        source="USER",
        severity="SUCCESS",
        idempotency_key=idem_key,
        payload={
            "challenge_id": challenge_id,
            "xp_reward": XP_REWARD,
            "hp_reward": HP_REWARD,
        },
    )

    # ── Return refreshed player state ─────────────────────────────────────────
    updated_profile = await profile_repo.get_profile(user_id)
    from .services.bootstrap_svc import BootstrapService
    player_state = BootstrapService(db)._build_player_state(updated_profile)

    return _success({
        "player_state": player_state.model_dump(),
        "xp_gained": XP_REWARD,
        "hp_gained": HP_REWARD,
    })


@router.post(
    "/unlocks/{unlock_id}/acknowledge",
    summary="Dismiss a level-up feature unlock modal",
)
async def acknowledge_unlock(
    unlock_id: str,
    user_id: CurrentUserID,
    db: DBClient,
) -> dict[str, Any]:
    """
    Marks a Level-Up feature unlock as acknowledged by the client.
    Removes it from the pending_unlocks list in future /bootstrap responses.

    Returns HTTP 404 if the unlock_id does not belong to the requesting user.
    """
    profile_repo = ProfileRepository(db)
    try:
        await profile_repo.mark_unlock_acknowledged(unlock_id, user_id)
    except ValueError:
        _raise_404(
            "UNLOCK_NOT_FOUND",
            f"Feature unlock {unlock_id} not found for this player.",
        )
    return _success({"acknowledged": True, "unlock_id": unlock_id})


# ===========================================================================
# ── LAZY-LOADED DRILL-DOWNS ─────────────────────────────────────────────────
# ===========================================================================


@router.get(
    "/challenges/history",
    summary="Paginated archived challenge history",
)
async def get_challenge_history(
    user_id: CurrentUserID,
    db: DBClient,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """
    Returns a paginated list of ARCHIVED (historical) quarterly challenges.
    Does not include ACTIVE or COMPLETED challenges — use /bootstrap for those.
    """
    profile_repo = ProfileRepository(db)
    challenges = await profile_repo.list_archived_challenges(
        user_id, limit=limit, offset=offset
    )
    return _success({
        "items": challenges,
        "limit": limit,
        "offset": offset,
        "count": len(challenges),
    })


@router.get(
    "/journal",
    summary="Paginated player journal entries",
)
async def get_journal(
    user_id: CurrentUserID,
    db: DBClient,
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """
    Returns paginated journal entries, newest first.
    The /bootstrap endpoint includes the 10 most recent entries. Use this
    endpoint for the full journal view with pagination.
    """
    profile_repo = ProfileRepository(db)
    entries = await profile_repo.get_journal_entries(
        user_id, limit=limit, offset=offset
    )
    return _success({
        "items": entries,
        "limit": limit,
        "offset": offset,
        "count": len(entries),
    })


@router.get(
    "/notifications",
    summary="Paginated player notifications",
)
async def get_notifications(
    user_id: CurrentUserID,
    db: DBClient,
    notification_status: str | None = Query(
        default=None,
        alias="status",
        description="Filter by status: UNREAD | READ | ARCHIVED",
    ),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """
    Returns paginated notifications with optional status filter.
    The /bootstrap endpoint includes all UNREAD notifications (up to 20).
    Use this endpoint for the full notification center.
    """
    profile_repo = ProfileRepository(db)
    items = await profile_repo.get_notifications(
        user_id,
        status=notification_status,
        limit=limit,
        offset=offset,
    )
    unread_count = await profile_repo.count_unread_notifications(user_id)

    return _success({
        "items": items,
        "unread_count": unread_count,
        "limit": limit,
        "offset": offset,
    })


@router.patch(
    "/notifications/{notification_id}",
    summary="Update notification status (READ / ARCHIVED)",
)
async def update_notification(
    notification_id: str,
    user_id: CurrentUserID,
    db: DBClient,
    body: NotificationUpdateRequest,
) -> dict[str, Any]:
    """
    Transitions a notification to READ or ARCHIVED.
    Returns HTTP 404 if the notification_id does not belong to the requesting user.
    """
    profile_repo = ProfileRepository(db)
    try:
        updated = await profile_repo.update_notification_status(
            notification_id, user_id, body.status.value
        )
    except ValueError:
        _raise_404(
            "NOTIFICATION_NOT_FOUND",
            f"Notification {notification_id} not found for this player.",
        )
    return _success({"notification": updated})


# ===========================================================================
# ── CROSS-DOMAIN INTEGRATION HOOK ──────────────────────────────────────────
# ===========================================================================


@router.post(
    "/internal/wallet-event",
    include_in_schema=False,  # Internal hook — excluded from public OpenAPI docs.
    summary="WalletService → JourneyService intercept (internal)",
)
async def wallet_event_hook(
    background_tasks: BackgroundTasks,
    db: DBClient,
    bus: Annotated[EventBus, Depends(get_event_bus)],
    payload: WalletTransactionEventPayload,
) -> JSONResponse:
    """
    Internal endpoint called by WalletService via FastAPI BackgroundTasks
    when a transaction is saved to the financial ledger.

    The WalletService saves the transaction, returns 200 OK to the frontend,
    then POSTs to this endpoint asynchronously to trigger the Journey Engine.

    This endpoint:
      1. Returns 202 Accepted immediately.
      2. Dispatches EXPENSE_LOGGED or INCOME_LOGGED via BackgroundTask.

    Auth: Internal service-to-service only. No user JWT required.
    The payload contains the user_id extracted from the original user request.

    Transfer transactions are ignored (no XP, no HP effects per spec).
    """
    if payload.transaction_type == "transfer":
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={"status": "ignored", "reason": "transfer_no_journey_effect"},
        )

    background_tasks.add_task(
        _process_wallet_transaction_event,
        db=db,
        bus=bus,
        payload=payload,
    )
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={"status": "accepted"},
    )


async def _process_wallet_transaction_event(
    db: AsyncClient,
    bus: EventBus,
    payload: WalletTransactionEventPayload,
) -> None:
    """
    Background task: processes a wallet transaction into the Journey event system.
    Called from the /internal/wallet-event endpoint BackgroundTask.
    """
    from .repos.event_repo import EventRepository as _ER

    local_date = _today_iso()
    event_repo = _ER(db)

    event_type = (
        "EXPENSE_LOGGED" if payload.transaction_type == "expense"
        else "INCOME_LOGGED"
    )
    idem_key = event_repo.build_idempotency_key(
        payload.user_id, local_date, event_type.lower(),
        suffix=payload.transaction_id[:8],
    )

    try:
        await bus.publish(
            user_id=payload.user_id,
            event_type=event_type,
            source="USER",
            severity="INFO",
            idempotency_key=idem_key,
            payload={
                "transaction_id": payload.transaction_id,
                "amount": int(payload.amount),
                "category_id": payload.category_id,
                "is_over_budget": payload.is_over_budget,
                "local_date": local_date,
            },
        )
    except Exception as exc:
        logger.exception(
            "_process_wallet_transaction_event: failed for user=%s txn=%s — %s",
            payload.user_id, payload.transaction_id, exc,
        )


# ===========================================================================
# ── CRON WEBHOOKS ───────────────────────────────────────────────────────────
# ===========================================================================


@router.post(
    "/cron/daily-evaluation",
    status_code=status.HTTP_202_ACCEPTED,
    summary="QStash webhook — Rolling Midnight evaluator",
    include_in_schema=False,
)
async def cron_daily_evaluation(
    _sig: QStashVerified,
    background_tasks: BackgroundTasks,
    db: DBClient,
    bus: Annotated[EventBus, Depends(get_event_bus)],
    body: CronDailyEvaluationRequest | None = None,
) -> JSONResponse:
    """
    Triggered hourly by Upstash QStash (schedule: `0 * * * *`).

    Pipeline:
      1. Verify Upstash-Signature header (QStashVerified dependency).
      2. Return 202 Accepted IMMEDIATELY to prevent QStash timeout retries.
      3. Determine which IANA timezones are currently at midnight.
         If body.target_timezone is provided, use that directly (for testing).
         Otherwise, auto-detect from CronService.get_timezones_at_midnight_now().
      4. Enqueue one BackgroundTask per timezone to process_rolling_midnight().

    Idempotency: QStash may retry if it drops the 202 response. Each user's
    MIDNIGHT_EVALUATION_STARTED event carries a unique idempotency key —
    duplicate injections are silently skipped by EventBus.

    Auth: Upstash-Signature HMAC verification only. No user JWT.
    """
    cron_svc = CronService(db=db, bus=bus)

    if body and body.target_timezone:
        # Explicit timezone override from request body (useful for testing).
        targets = [(body.target_timezone, body.trigger_date)]
    else:
        # Auto-detect which timezones are currently at midnight.
        targets = CronService.get_timezones_at_midnight_now()

    if not targets:
        logger.info(
            "cron_daily_evaluation: no timezones at midnight right now — no-op."
        )
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={"status": "accepted", "timezones_queued": 0},
        )

    for tz_name, local_date in targets:
        background_tasks.add_task(
            cron_svc.process_rolling_midnight,
            target_timezone=tz_name,
            trigger_date=local_date,
        )
        logger.info(
            "cron_daily_evaluation: queued timezone=%s date=%s", tz_name, local_date
        )

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={
            "status": "accepted",
            "timezones_queued": len(targets),
            "timezones": [t[0] for t in targets],
        },
    )


@router.post(
    "/cron/system-cleanup",
    status_code=status.HTTP_202_ACCEPTED,
    summary="QStash webhook — Daily Janitor",
    include_in_schema=False,
)
async def cron_system_cleanup(
    _sig: QStashVerified,
    background_tasks: BackgroundTasks,
    db: DBClient,
    bus: Annotated[EventBus, Depends(get_event_bus)],
    _body: CronSystemCleanupRequest | None = None,
) -> JSONResponse:
    """
    Triggered once per UTC day by Upstash QStash (schedule: `0 0 * * *`).

    Returns 202 immediately. All cleanup work runs in a BackgroundTask:
      - Expires overdue Defense Shields (AVAILABLE → EXPIRED).
      - Transitions stale Standby Tokens (ACTIVE → USED).
      - Clears stalled PREPARING challenges older than 24 hours.

    Auth: Upstash-Signature HMAC verification only. No user JWT.
    """
    cron_svc = CronService(db=db, bus=bus)
    background_tasks.add_task(cron_svc.run_daily_cleanup)

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={"status": "accepted", "job": "system-cleanup"},
    )

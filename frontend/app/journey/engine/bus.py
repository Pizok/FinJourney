"""
src/backend/journey/events/bus.py

The central Event Bus dispatcher for the Journey Engine.

Architecture:
  All significant actions in FinJourney generate events rather than executing
  logic directly. Services publish events to the bus. The bus writes them to
  journey_events, dispatches them to the registered handler, and transitions
  the event through its lifecycle.

Event lifecycle (journey_state_machine.md §5):
  CREATED → (handler evaluation) → PROCESSED → (distribution) → PUBLISHED
  CREATED → (handler exception) → FAILED

Cascading events:
  Handlers may publish further events by calling ctx.bus.emit(...).
  Each cascading emit is awaited synchronously — the full chain resolves
  before the originating handler returns. This means the cascade:

    EXPENSE_LOGGED → OVERSPEND_DETECTED → HP_CHANGED → HP_CRITICAL_FAILURE

  completes atomically from the caller's perspective, with every event in the
  chain reaching PUBLISHED before the parent event is marked PROCESSED.

Idempotency:
  Every event carries a deterministic idempotency_key. EventRepository
  suppresses duplicate inserts transparently and returns is_duplicate=True.
  Handlers MUST check this flag before applying any side effect. The bus
  enforces this at the framework level by returning early on duplicates
  without invoking the handler at all.

Circular import strategy:
  handlers.py imports EventContext from this module (TYPE_CHECKING only).
  This module imports handlers lazily via EventBus._load_handlers() on the
  first call to publish(), after bus.py is fully initialized. This breaks
  the circular dependency without sacrificing handler auto-registration.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Awaitable, Callable, ClassVar

from supabase import AsyncClient

from ..repos.event_repo import EventRepository
from fastapi import BackgroundTasks
from app.journey.services.advancement_svc import evaluate_node_advancement

if TYPE_CHECKING:
    pass  # No circular types needed from this side.

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Type Aliases
# ---------------------------------------------------------------------------

HandlerFn = Callable[["EventContext"], Awaitable[None]]


# ---------------------------------------------------------------------------
# Event Context
# ---------------------------------------------------------------------------


@dataclass
class EventContext:
    """
    Runtime context injected into every handler invocation.

    Handlers receive this object rather than individual arguments to keep
    handler signatures stable as the system evolves. All dependencies a
    handler needs — the bus for cascading events, the db client for repo
    instantiation — are available here.

    Attributes:
        event:   Full journey_events row dict as inserted by the bus.
                 Includes id, idempotency_key, event_type, status, payload, etc.
        bus:     Active EventBus reference for publishing cascading events.
                 Use: await ctx.bus.emit(user_id=..., event_type=..., ...)
        db:      Supabase AsyncClient. Used by handlers to instantiate repos:
                 repo = ProfileRepository(ctx.db)
        user_id: Player UUID string, pre-extracted for convenience.
        payload: The event's JSON payload dict. Identical to event["payload"].
    """

    event: dict[str, Any]
    bus: "EventBus"
    db: AsyncClient
    user_id: str
    payload: dict[str, Any] = field(default_factory=dict)

    # ------------------------------------------------------------------
    # Convenience Properties
    # ------------------------------------------------------------------

    @property
    def event_id(self) -> str:
        return self.event["id"]

    @property
    def event_type(self) -> str:
        return self.event["event_type"]

    @property
    def idempotency_key(self) -> str:
        return self.event["idempotency_key"]

    @property
    def source(self) -> str:
        return self.event.get("source", "UNKNOWN")

    @property
    def severity(self) -> str:
        return self.event.get("severity", "INFO")


# ---------------------------------------------------------------------------
# EventBus
# ---------------------------------------------------------------------------


class EventBus:
    """
    Central dispatcher for all Journey Engine events.

    Typical usage from a FastAPI BackgroundTask:

        bus = EventBus(db_client)
        await bus.publish(
            user_id="uuid-string",
            event_type="EXPENSE_LOGGED",
            source="USER",
            severity="INFO",
            idempotency_key=EventRepository.build_idempotency_key(
                user_id, local_date, "expense_logged", suffix=transaction_id[:8]
            ),
            payload={
                "amount": 50000,
                "category_id": "uuid",
                "is_over_budget": True,
                "variance": 12000,
                "transaction_id": "uuid",
                "local_date": "2026-10-14",
            },
        )

    Handler registration:
        Handlers in handlers.py self-register via the @on() decorator at
        module load time. They are imported lazily on the first publish()
        call to avoid circular imports. Once loaded, the registry is cached
        at the class level across all EventBus instances.

    Cross-request safety:
        EventBus is instantiated per-request via FastAPI dependency injection.
        The class-level _handler_registry is loaded once and is read-only
        after that point — safe for concurrent async access.
    """

    # Class-level registry cache — populated once, shared across all instances.
    _handler_registry: ClassVar[dict[str, HandlerFn] | None] = None

    def __init__(self, db: AsyncClient, background_tasks: BackgroundTasks | None = None) -> None:
        self._db = db
        self._event_repo = EventRepository(db)
        self._background_tasks = background_tasks

    # ------------------------------------------------------------------
    # Handler Registry — Lazy Load
    # ------------------------------------------------------------------

    @classmethod
    def _load_handlers(cls) -> dict[str, HandlerFn]:
        """
        Imports handlers.py on first call and caches the REGISTRY dict.

        Deferred import is mandatory — handlers.py imports EventContext from
        this module at type-check time, so both modules must be fully defined
        before either imports the other at runtime. Lazy loading here ensures
        bus.py is 100% initialized before handlers.py is evaluated.

        Thread / async safety: Python's GIL and the single-threaded async
        event loop mean the first concurrent publish() calls will all see
        _handler_registry as None and trigger the import. Python's module
        cache (sys.modules) ensures handlers.py is only executed once, and
        subsequent assignments to _handler_registry are idempotent.
        """
        if cls._handler_registry is None:
            from . import handlers as _handlers_module  # noqa: PLC0415
            cls._handler_registry = _handlers_module.REGISTRY
            logger.info(
                "EventBus: handler registry loaded — %d event type(s) registered: [%s]",
                len(cls._handler_registry),
                ", ".join(sorted(cls._handler_registry.keys())),
            )
        return cls._handler_registry

    # ------------------------------------------------------------------
    # Public Interface
    # ------------------------------------------------------------------

    async def publish(
        self,
        *,
        user_id: str,
        event_type: str,
        source: str,
        severity: str,
        idempotency_key: str,
        payload: dict[str, Any] | None = None,
        event_version: int = 1,
    ) -> dict[str, Any]:
        """
        Publishes an event through the full lifecycle pipeline.

        Pipeline:
          1. Write event to journey_events with status=CREATED.
          2. If idempotency_key already exists → return existing row. No-op.
          3. Resolve the registered handler for this event_type.
          4. If no handler → log warning, mark PUBLISHED, return.
          5. Build EventContext and invoke handler.
          6. On success → mark PROCESSED, then PUBLISHED.
          7. On exception → mark FAILED, re-raise to the caller.

        Args:
            user_id:         Player UUID string.
            event_type:      String identifier, e.g. "EXPENSE_LOGGED".
                             Must match an @on() registration in handlers.py.
            source:          Origin of the event: "USER" | "SYSTEM" | "ENGINE".
            severity:        Impact level: "INFO" | "SUCCESS" | "WARNING" | "DANGER".
            idempotency_key: Unique deterministic key for this event instance.
                             Use EventRepository.build_idempotency_key().
            payload:         Arbitrary JSON-serializable dict. Defaults to {}.
            event_version:   Schema version for future payload migrations. Default 1.

        Returns:
            The full journey_events row dict (newly inserted or existing duplicate).

        Raises:
            Exception: Any unhandled exception raised by the handler.
                       The event is marked FAILED before propagation.
        """
        resolved_payload = payload or {}

        # ── 1. Write event (idempotent) ──────────────────────────────────────
        insert_result = await self._event_repo.insert_event(
            user_id=user_id,
            event_type=event_type,
            source=source,
            severity=severity,
            idempotency_key=idempotency_key,
            payload=resolved_payload,
            event_version=event_version,
        )

        # ── 2. Idempotency guard ─────────────────────────────────────────────
        if insert_result.is_duplicate:
            logger.info(
                "EventBus.publish: duplicate suppressed — "
                "event_type=%s key=%s user=%s",
                event_type,
                idempotency_key,
                user_id,
            )
            return insert_result.data

        event_row = insert_result.data
        event_id: str = event_row["id"]

        # ── 3. Resolve handler ───────────────────────────────────────────────
        handlers = self._load_handlers()
        handler = handlers.get(event_type)

        if handler is None:
            logger.warning(
                "EventBus.publish: no handler registered for event_type=%s "
                "(user=%s) — marking PUBLISHED without processing.",
                event_type,
                user_id,
            )
            await self._mark_published(event_id)
            return event_row

        # ── 4. Build context ─────────────────────────────────────────────────
        ctx = EventContext(
            event=event_row,
            bus=self,
            db=self._db,
            user_id=user_id,
            payload=resolved_payload,
        )

        # ── 5–7. Dispatch ────────────────────────────────────────────────────
        await self._dispatch(handler, ctx, event_id)
        return event_row

    # Semantic alias used by handlers when emitting cascading events.
    # Calling ctx.bus.emit(...) reads as "this handler is emitting a new event"
    # rather than "this handler is publishing to external consumers", which
    # distinguishes intent from the top-level publish() call at service boundaries.
    emit = publish

    # ------------------------------------------------------------------
    # Internal Dispatch
    # ------------------------------------------------------------------

    async def _dispatch(
        self,
        handler: HandlerFn,
        ctx: EventContext,
        event_id: str,
    ) -> None:
        """
        Invokes the handler coroutine and manages event lifecycle transitions.

        On success:  CREATED → PROCESSED → PUBLISHED
        On failure:  CREATED → FAILED    (then re-raise)

        The two-step success transition (PROCESSED then PUBLISHED) preserves the
        state machine semantics from the spec even though, for MVP, both steps
        occur in the same request context. Future refactors can insert an async
        distribution queue between PROCESSED and PUBLISHED without changing this
        interface.
        """
        try:
            # --- DEV ACCOUNT SUPPRESSION ---
            penalty_events = {"DAILY_BLEED", "GHOST_PENALTY", "GHOST_PENALTY_APPLIED", "STANDBY_USED"}
            is_hp_loss = ctx.event_type == "HP_CHANGED" and ctx.payload.get("delta", 0) < 0
            
            if ctx.event_type in penalty_events or is_hp_loss:
                resp = await self._db.table("journey_profiles").select("is_dev_account").eq("id", ctx.user_id).maybe_single().execute()
                if resp.data and resp.data.get("is_dev_account"):
                    logger.info("EventBus: DEV ACCOUNT SUPPRESSION — skipping %s for user=%s", ctx.event_type, ctx.user_id)
                    # Mark as published to complete lifecycle, but record suppression in error_log
                    await self._event_repo.update_event_status(event_id, "PUBLISHED", error_log="SKIPPED (Dev Account)")
                    return
            # -------------------------------

            logger.debug(
                "EventBus._dispatch: invoking handler=%s event_id=%s user=%s",
                handler.__name__,
                event_id,
                ctx.user_id,
            )
            await handler(ctx)
            await self._mark_processed(event_id)
            await self._mark_published(event_id)
            
            # Post-processing hooks
            if self._background_tasks:
                self._background_tasks.add_task(evaluate_node_advancement, self._db, ctx.user_id)
            else:
                # Fallback if no background_tasks (e.g. tests)
                evaluate_node_advancement(self._db, ctx.user_id)

            logger.debug(
                "EventBus._dispatch: completed — type=%s id=%s user=%s",
                ctx.event_type,
                event_id,
                ctx.user_id,
            )
        except Exception as exc:
            error_log = f"{type(exc).__name__}: {exc}"
            logger.exception(
                "EventBus._dispatch: handler failed — type=%s id=%s user=%s error=%r",
                ctx.event_type,
                event_id,
                ctx.user_id,
                error_log,
            )
            await self._mark_failed(event_id, error_log)
            raise

    # ------------------------------------------------------------------
    # Lifecycle Transitions
    # ------------------------------------------------------------------

    async def _mark_processed(self, event_id: str) -> None:
        """Advances event from CREATED to PROCESSED after handler evaluation."""
        await self._event_repo.update_event_status(event_id, "PROCESSED")

    async def _mark_published(self, event_id: str) -> None:
        """Advances event from PROCESSED to PUBLISHED after distribution."""
        await self._event_repo.update_event_status(event_id, "PUBLISHED")

    async def _mark_failed(self, event_id: str, error_log: str) -> None:
        """Marks event as FAILED with the exception trace for dead-letter inspection."""
        await self._event_repo.update_event_status(
            event_id, "FAILED", error_log=error_log
        )

    # ------------------------------------------------------------------
    # Diagnostics
    # ------------------------------------------------------------------

    def registered_event_types(self) -> list[str]:
        """Returns a sorted list of all registered event type strings. For health checks."""
        return sorted(self._load_handlers().keys())

    def is_handler_registered(self, event_type: str) -> bool:
        """Returns True if a handler exists for the given event type."""
        return event_type in self._load_handlers()

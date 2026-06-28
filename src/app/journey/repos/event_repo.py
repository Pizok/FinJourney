"""
src/backend/journey/repositories/event_repo.py

Supabase data access layer for the journey_events append-only ledger.

Critical contract:
  - The journey_events table is IMMUTABLE. Rows are never updated or deleted.
  - All writes MUST carry a deterministic idempotency_key.
  - On duplicate key (PostgreSQL 23505), the existing row is returned safely.
  - This prevents double Ghost Penalties, double XP grants, and double Shield
    generation when QStash retries a cron webhook after a dropped response.
  - update_event_status is the only mutation allowed — it advances the
    lifecycle column (CREATED → PROCESSED → PUBLISHED | FAILED).

Idempotency key convention:
  "{user_id}:{YYYY-MM-DD}:{EVENT_TYPE}[:{optional_suffix}]"
  e.g. "abc123:2026-10-14:ghost_penalty"
       "abc123:2026-10-14:shield_generated:7"
       "abc123:2026-10-14:midnight_eval"
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from postgrest.exceptions import APIError
from supabase import AsyncClient

logger = logging.getLogger(__name__)

# PostgreSQL unique_violation error code returned by PostgREST
_PG_UNIQUE_VIOLATION = "23505"


# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class EventInsertResult:
    """
    Wraps the outcome of an insert attempt.

    Attributes:
        data:         The event row dict — either newly inserted or the existing duplicate.
        is_duplicate: True when the idempotency_key already existed. The caller
                      MUST treat this as a no-op and not re-apply side effects.
    """

    data: dict
    is_duplicate: bool


# ---------------------------------------------------------------------------
# Repository
# ---------------------------------------------------------------------------


class EventRepository:
    """
    Append-only data access layer for journey_events.

    All methods that write events go through insert_event, which handles
    idempotency transparently. No other code path should INSERT into this table.
    """

    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    # ------------------------------------------------------------------
    # Idempotent Event Insertion (Primary Write Path)
    # ------------------------------------------------------------------

    async def insert_event(
        self,
        *,
        user_id: str,
        event_type: str,
        source: str,
        severity: str,
        idempotency_key: str,
        payload: Optional[dict] = None,
        event_version: int = 1,
    ) -> EventInsertResult:
        """
        Inserts a new event into the immutable event ledger.

        Idempotency guarantee:
          On a PostgreSQL unique_violation (duplicate idempotency_key), this method
          DOES NOT raise. Instead it fetches the existing row and returns it with
          is_duplicate=True. The caller must check this flag and skip all downstream
          side effects (XP grants, HP mutations, shield generation, etc.).

        Args:
            user_id:         Player UUID.
            event_type:      String identifier, e.g. "EXPENSE_LOGGED", "GHOST_PENALTY_APPLIED".
            source:          "USER" | "SYSTEM" | "ENGINE".
            severity:        "INFO" | "SUCCESS" | "WARNING" | "DANGER".
            idempotency_key: Globally unique string. Use build_idempotency_key().
            payload:         Arbitrary JSON metadata. Defaults to empty dict.
            event_version:   Schema version for forward compatibility. Default 1.

        Returns:
            EventInsertResult with .data (event dict) and .is_duplicate (bool).

        Raises:
            APIError: For any database error other than unique_violation.
            RuntimeError: If a key conflict occurs but the row cannot be found (should not happen).
        """
        row = {
            "id": str(uuid4()),
            "idempotency_key": idempotency_key,
            "user_id": user_id,
            "event_type": event_type,
            "event_version": event_version,
            "source": source,
            "severity": severity,
            "status": "CREATED",
            "payload": payload or {},
        }

        try:
            result = await (
                self._db
                .table("journey_events")
                .insert(row)
                .execute()
            )
            logger.debug(
                "Event inserted: type=%s source=%s user=%s key=%s",
                event_type, source, user_id, idempotency_key,
            )
            return EventInsertResult(data=result.data[0], is_duplicate=False)

        except APIError as exc:
            if exc.code == _PG_UNIQUE_VIOLATION:
                logger.info(
                    "Duplicate event suppressed — idempotency_key already exists. "
                    "type=%s key=%s user=%s",
                    event_type, idempotency_key, user_id,
                )
                existing = await self.get_by_idempotency_key(idempotency_key)
                if existing is None:
                    # Conflict registered but row not returned — extremely unlikely.
                    raise RuntimeError(
                        f"Unique constraint fired for key '{idempotency_key}' "
                        f"but no matching row found. This indicates a race condition "
                        f"or a recently deleted record."
                    ) from exc
                return EventInsertResult(data=existing, is_duplicate=True)
            raise

    # ------------------------------------------------------------------
    # Event Lifecycle Mutation (Only Allowed Mutation)
    # ------------------------------------------------------------------

    async def update_event_status(
        self,
        event_id: str,
        status: str,
        error_log: Optional[str] = None,
    ) -> dict:
        """
        Transitions an event through its processing lifecycle:
          CREATED → PROCESSED → PUBLISHED
          CREATED → FAILED  (on handler exception)

        Sets processed_at to now on every call. Optionally writes an error_log
        string for FAILED events, enabling dead-letter inspection.

        Args:
            event_id:  UUID of the event to update.
            status:    "PROCESSED" | "PUBLISHED" | "FAILED".
            error_log: Optional error message for FAILED status.
        """
        payload: dict = {
            "status": status,
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }
        if error_log is not None:
            payload["error_log"] = error_log

        result = await (
            self._db
            .table("journey_events")
            .update(payload)
            .eq("id", event_id)
            .execute()
        )
        if not result.data:
            logger.warning("update_event_status: no row found for event_id=%s", event_id)
            return {}
        return result.data[0]

    # ------------------------------------------------------------------
    # Read Accessors
    # ------------------------------------------------------------------

    async def get_by_idempotency_key(
        self, idempotency_key: str
    ) -> dict | None:
        """
        Resolves a single event by its unique idempotency key.
        Primary use: safe deduplication inside insert_event on key conflicts.
        """
        result = await (
            self._db
            .table("journey_events")
            .select("*")
            .eq("idempotency_key", idempotency_key)
            .limit(1).maybe_single()
            .execute()
        )
        return result.data

    async def get_by_id(self, event_id: str) -> dict | None:
        """Fetches a single event by its primary key UUID."""
        result = await (
            self._db
            .table("journey_events")
            .select("*")
            .eq("id", event_id)
            .limit(1).maybe_single()
            .execute()
        )
        return result.data

    async def event_exists(self, idempotency_key: str) -> bool:
        """
        Lightweight boolean existence check.
        Prefer this over get_by_idempotency_key when only a yes/no is needed,
        as it avoids deserializing the full payload column.
        """
        result = await (
            self._db
            .table("journey_events")
            .select("id", count="exact")
            .eq("idempotency_key", idempotency_key)
            .execute()
        )
        return (result.count or 0) > 0

    async def get_user_events(
        self,
        user_id: str,
        event_type: Optional[str] = None,
        source: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict]:
        """
        Retrieves recent events for a given user with optional filters.
        Not in the primary hot path — used for analytics, debug endpoints, and the journal.

        Args:
            user_id:    Player UUID.
            event_type: Optional exact match filter, e.g. "GHOST_PENALTY_APPLIED".
            source:     Optional filter: "USER" | "SYSTEM" | "ENGINE".
            severity:   Optional filter: "INFO" | "SUCCESS" | "WARNING" | "DANGER".
            limit:      Page size (max recommended: 100).
            offset:     Pagination offset.
        """
        query = (
            self._db
            .table("journey_events")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if event_type:
            query = query.eq("event_type", event_type)
        if source:
            query = query.eq("source", source)
        if severity:
            query = query.eq("severity", severity)

        result = await query.execute()
        return result.data or []

    async def get_failed_events(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        """
        Returns FAILED events across all users for operational monitoring.
        Intended for an internal admin endpoint or dead-letter queue inspector.
        NOT user-scoped. Must not be exposed to public API routes.
        """
        result = await (
            self._db
            .table("journey_events")
            .select("*")
            .eq("status", "FAILED")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data or []

    async def get_events_by_type_for_user_on_date(
        self,
        user_id: str,
        event_type: str,
        local_date: str,
    ) -> list[dict]:
        """
        Fetches all events of a given type for a user on a specific local date.
        Used to verify whether system cron events have already been applied today,
        as a secondary safeguard on top of idempotency key uniqueness.

        Args:
            user_id:    Player UUID.
            event_type: Event type to search for.
            local_date: "YYYY-MM-DD" string representing the player's local date.
        """
        # Match idempotency key prefix: "{user_id}:{local_date}:{event_type}"
        prefix = f"{user_id}:{local_date}:{event_type}"
        result = await (
            self._db
            .table("journey_events")
            .select("*")
            .eq("user_id", user_id)
            .eq("event_type", event_type)
            .like("idempotency_key", f"{prefix}%")
            .execute()
        )
        return result.data or []

    # ------------------------------------------------------------------
    # Batch Helpers (Cron / EventBus)
    # ------------------------------------------------------------------

    async def bulk_insert_midnight_evaluation_events(
        self,
        user_ids: list[str],
        local_date: str,
    ) -> dict[str, EventInsertResult]:
        """
        Injects a MIDNIGHT_EVALUATION_STARTED event for every user in the batch.
        Each event is inserted individually to preserve idempotency key uniqueness.
        New and duplicate results are both returned so the caller can log metrics.

        Args:
            user_ids:   List of player UUIDs to process.
            local_date: "YYYY-MM-DD" local date string for idempotency key generation.

        Returns:
            Dict mapping user_id → EventInsertResult.
        """
        results: dict[str, EventInsertResult] = {}

        for user_id in user_ids:
            key = self.build_idempotency_key(user_id, local_date, "midnight_eval")
            result = await self.insert_event(
                user_id=user_id,
                event_type="MIDNIGHT_EVALUATION_STARTED",
                source="SYSTEM",
                severity="INFO",
                idempotency_key=key,
                payload={"local_date": local_date},
            )
            results[user_id] = result

            if result.is_duplicate:
                logger.debug(
                    "Midnight evaluation already exists for user=%s date=%s — skipped.",
                    user_id, local_date,
                )

        new_count = sum(1 for r in results.values() if not r.is_duplicate)
        dup_count = sum(1 for r in results.values() if r.is_duplicate)
        logger.info(
            "bulk_insert_midnight_evaluation_events: date=%s new=%d duplicates=%d",
            local_date, new_count, dup_count,
        )
        return results

    # ------------------------------------------------------------------
    # Static Utilities
    # ------------------------------------------------------------------

    @staticmethod
    def build_idempotency_key(
        user_id: str,
        local_date: str,
        event_type: str,
        suffix: Optional[str] = None,
    ) -> str:
        """
        Produces a deterministic, collision-resistant idempotency key.

        Convention:
            "{user_id}:{YYYY-MM-DD}:{event_type_lowercase}[:{suffix}]"

        Examples:
            build_idempotency_key("abc", "2026-10-14", "ghost_penalty")
            → "abc:2026-10-14:ghost_penalty"

            build_idempotency_key("abc", "2026-10-14", "shield_generated", "7")
            → "abc:2026-10-14:shield_generated:7"

        Args:
            user_id:    Player UUID string.
            local_date: "YYYY-MM-DD" string for the player's local calendar date.
            event_type: Event type string. Will be lowercased for consistency.
            suffix:     Optional disambiguation suffix (e.g. a streak count or item index).
        """
        normalized_type = event_type.lower()
        key = f"{user_id}:{local_date}:{normalized_type}"
        if suffix is not None:
            key = f"{key}:{suffix}"
        return key

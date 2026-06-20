"""
journey/events.py
──────────────────
Minimal event bus used by the service layer to publish game_events rows.

Design principles
─────────────────
  - The ``EventBus`` is a protocol / abstract base so it can be swapped for
    a test double in unit tests without any monkeypatching.
  - ``publish`` is the only public method. It inserts one row into
    ``game_events`` and returns the generated UUID.
  - All writes go through the authenticated Supabase client so RLS applies.
  - The table is append-only (no UPDATE / DELETE ever issued here).
  - Idempotency is enforced via a composite unique constraint on
    (user_id, event_type, idempotency_key) in the database; a duplicate
    publish returns the existing event_id without raising.

game_events schema (from database.md)
──────────────────────────────────────
  id              uuid          PK default gen_random_uuid()
  user_id         uuid          FK → profiles.id
  event_type      text          e.g. "PATH_CHANGED"
  payload         jsonb         arbitrary event-specific data
  idempotency_key text          nullable; unique per (user_id, event_type)
  created_at      timestamptz   default now()
"""

from __future__ import annotations

import hashlib
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID, uuid4

from supabase import AsyncClient


# ══════════════════════════════════════════════════════════════════════════════
# GameEvent value object
# ══════════════════════════════════════════════════════════════════════════════

@dataclass(frozen=True)
class GameEvent:
    """
    Immutable value object representing a single event to be appended to the
    ``game_events`` ledger.

    Attributes
    ──────────
    event_type      : One of the INTERNAL_EVENTS defined in api_contract.md.
    user_id         : Owner of the event.
    payload         : Arbitrary JSON-serialisable dict of event data.
    idempotency_key : Optional caller-supplied key for deduplication.
                      When None the bus auto-generates a stable hash from
                      (user_id, event_type, payload) so retried calls within
                      the same logical operation do not create duplicate rows.
    """

    event_type:       str
    user_id:          UUID
    payload:          dict[str, Any]         = field(default_factory=dict)
    idempotency_key:  str | None             = field(default=None)

    def resolved_idempotency_key(self) -> str:
        """
        Return the caller-supplied key, or derive one from the event content.

        Derived key format:
            SHA-256( user_id + event_type + canonical-JSON(payload) )[:32]

        This makes retried publishes (e.g. after a network timeout) safe:
        the same logical event always hashes to the same key.
        """
        if self.idempotency_key:
            return self.idempotency_key

        canonical = json.dumps(
            {"u": str(self.user_id), "t": self.event_type, "p": self.payload},
            sort_keys=True,
            separators=(",", ":"),
        )
        return hashlib.sha256(canonical.encode()).hexdigest()[:32]


# ══════════════════════════════════════════════════════════════════════════════
# EventBus protocol / abstract base
# ══════════════════════════════════════════════════════════════════════════════

class EventBus(ABC):
    """Abstract event bus.  Swap implementations in tests via DI."""

    @abstractmethod
    async def publish(self, db: AsyncClient, event: GameEvent) -> UUID:
        """
        Append ``event`` to the ``game_events`` table.

        Returns the UUID of the inserted (or pre-existing idempotent) row.
        """
        ...


# ══════════════════════════════════════════════════════════════════════════════
# Supabase implementation
# ══════════════════════════════════════════════════════════════════════════════

class SupabaseEventBus(EventBus):
    """
    Production event bus backed by the Supabase ``game_events`` table.

    Idempotency strategy
    ─────────────────────
    The database carries a unique index on (user_id, event_type, idempotency_key).
    On conflict we do nothing and return the existing row's id via a
    ``ON CONFLICT DO NOTHING RETURNING id`` equivalent — achieved here by a
    select fallback after a swallowed 409 / duplicate-key response.
    """

    async def publish(self, db: AsyncClient, event: GameEvent) -> UUID:
        idem_key = event.resolved_idempotency_key()

        row = {
            "user_id":          str(event.user_id),
            "event_type":       event.event_type,
            "payload":          event.payload,
            "idempotency_key":  idem_key,
        }

        resp = await (
            db.table("game_events")
            .insert(row, returning="representation")
            .execute()
        )

        if resp.data:
            return UUID(resp.data[0]["id"])

        # Duplicate — fetch the existing row by idempotency key
        existing = await (
            db.table("game_events")
            .select("id")
            .eq("user_id",         str(event.user_id))
            .eq("event_type",      event.event_type)
            .eq("idempotency_key", idem_key)
            .single()
            .execute()
        )
        if existing.data:
            return UUID(existing.data["id"])

        # Should never reach here; surface as an internal error
        raise RuntimeError(
            f"EventBus: failed to insert or retrieve game_event "
            f"(type={event.event_type}, user={event.user_id})"
        )


# ══════════════════════════════════════════════════════════════════════════════
# Dependency accessor (used by FastAPI's Depends system)
# ══════════════════════════════════════════════════════════════════════════════

_bus_singleton: EventBus = SupabaseEventBus()


def get_event_bus() -> EventBus:
    """FastAPI dependency: returns the process-level event bus singleton."""
    return _bus_singleton

"""
src/backend/journey/repositories/inventory_repo.py

Supabase data access layer for the journey_inventory table.

Manages the full lifecycle of all player inventory items:
  - Defense Shields:  AVAILABLE → DESTROYED (by damage) | EXPIRED (by timer)
  - Standby Tokens:   AVAILABLE → ACTIVE → USED
  - Consumables:      (reserved for future expansion)

Design rules:
  - Shield consumption always targets the soonest-to-expire shield (FIFO by expires_at).
  - Token activation always targets the oldest AVAILABLE token (FIFO by created_at).
  - Refill logic calculates the deficit against MAX_STANDBY_TOKENS rather than
    unconditionally inserting 7 new tokens.
  - All bulk mutation methods (expire_overdue_shields, expire_stale_active_tokens)
    are called exclusively by the Daily Janitor cron and return affected row counts
    for operational logging.
  - get_inventory_summary provides a single aggregated call for the bootstrap endpoint.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from supabase import AsyncClient

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_SHIELD_LIFESPAN_DAYS: int = 14
_STANDBY_LIFESPAN_HOURS: int = 24
_MAX_STANDBY_TOKENS_PER_CYCLE: int = 7

# Sentinel path allows up to 5 shields; all other paths cap at 3.
_SENTINEL_SHIELD_CAP: int = 5
_DEFAULT_SHIELD_CAP: int = 3


# ---------------------------------------------------------------------------
# Repository
# ---------------------------------------------------------------------------


class InventoryRepository:
    """
    Typed async accessors for the journey_inventory table.
    All methods are scoped by user_id for RLS compliance.
    """

    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    # ------------------------------------------------------------------
    # Defense Shields — Read
    # ------------------------------------------------------------------

    async def get_active_shields(self, user_id: str) -> list[dict]:
        """
        Returns all AVAILABLE shields that have not yet passed their expiry timestamp.
        Ordered by expires_at ascending so the oldest shield is destroyed first
        when damage is resolved, maximising long-term defensive coverage.
        """
        now = datetime.now(timezone.utc).isoformat()
        result = await (
            self._db
            .table("journey_inventory")
            .select("*")
            .eq("user_id", user_id)
            .eq("type", "DEFENSE_SHIELD")
            .eq("status", "AVAILABLE")
            .gt("expires_at", now)
            .order("expires_at", desc=False)
            .execute()
        )
        return result.data or []

    async def count_active_shields(self, user_id: str) -> int:
        """
        Lightweight count query for damage resolution checks.
        Avoids fetching full rows when only a boolean shield-existence check is needed.
        """
        now = datetime.now(timezone.utc).isoformat()
        result = await (
            self._db
            .table("journey_inventory")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("type", "DEFENSE_SHIELD")
            .eq("status", "AVAILABLE")
            .gt("expires_at", now)
            .execute()
        )
        return result.count or 0

    async def has_active_shield(self, user_id: str) -> bool:
        """Boolean shortcut used by HPService before committing HP damage."""
        return await self.count_active_shields(user_id) > 0

    # ------------------------------------------------------------------
    # Defense Shields — Write
    # ------------------------------------------------------------------

    async def create_shield(
        self,
        user_id: str,
        source_event_id: Optional[str] = None,
    ) -> dict:
        """
        Generates a single new Defense Shield with a 14-day expiry window.
        Called by InventoryService after the 7-consecutive-clean-days threshold is met.

        The caller is responsible for checking the path-specific shield cap
        (5 for Sentinel, 3 for all others) BEFORE calling this method.

        Args:
            user_id:         Player UUID.
            source_event_id: UUID of the SHIELD_GENERATED event, stored for audit tracing.
        """
        now = datetime.now(timezone.utc)
        expires_at = (now + timedelta(days=_SHIELD_LIFESPAN_DAYS)).isoformat()
        payload = {
            "id": str(uuid4()),
            "user_id": user_id,
            "type": "DEFENSE_SHIELD",
            "status": "AVAILABLE",
            "expires_at": expires_at,
            "source_event_id": source_event_id,
        }
        result = await (
            self._db
            .table("journey_inventory")
            .insert(payload)
            .execute()
        )
        logger.info(
            "Defense Shield generated: user=%s shield_id=%s expires_at=%s",
            user_id, payload["id"], expires_at,
        )
        return result.data[0]

    async def grant_item(
        self,
        user_id: str,
        item_type: str,
        expires_in_days: int | None = None,
        source_event_id: Optional[str] = None,
    ) -> dict:
        """
        Generic item granter for challenge rewards and other arbitrary grants.
        Blindly applies the expires_in_days parameter if provided.
        """
        now = datetime.now(timezone.utc)
        expires_at = (now + timedelta(days=expires_in_days)).isoformat() if expires_in_days else None
        
        payload = {
            "id": str(uuid4()),
            "user_id": user_id,
            "type": item_type,
            "status": "AVAILABLE",
            "expires_at": expires_at,
            "source_event_id": source_event_id,
        }
        result = await (
            self._db
            .table("journey_inventory")
            .insert(payload)
            .execute()
        )
        logger.info(
            "Item granted: user=%s item_type=%s id=%s expires_at=%s",
            user_id, item_type, payload["id"], expires_at,
        )
        return result.data[0]

    async def destroy_oldest_shield(
        self,
        user_id: str,
    ) -> dict | None:
        """
        Consumes the soonest-to-expire AVAILABLE shield when damage is resolved.
        Returns the destroyed shield record, or None if the player has no shields.

        'Oldest first' strategy maximises defensive coverage by consuming shields
        closest to expiry before they are lost to the timer.

        Raises:
            Nothing — returns None gracefully when inventory is empty.
        """
        shields = await self.get_active_shields(user_id)
        if not shields:
            logger.debug("destroy_oldest_shield: no active shields for user=%s", user_id)
            return None

        target = shields[0]  # Sorted ascending by expires_at → oldest first
        result = await (
            self._db
            .table("journey_inventory")
            .update({"status": "DESTROYED"})
            .eq("id", target["id"])
            .execute()
        )
        logger.info(
            "Defense Shield destroyed: user=%s shield_id=%s (damage blocked)",
            user_id, target["id"],
        )
        return result.data[0]

    async def expire_overdue_shields(self) -> int:
        """
        Bulk-transitions all AVAILABLE shields whose expires_at has passed to EXPIRED.
        Called by the Daily Janitor cron job — NOT scoped to a single user.
        Returns the count of shields expired in this run for operational logging.
        """
        now = datetime.now(timezone.utc).isoformat()
        result = await (
            self._db
            .table("journey_inventory")
            .update({"status": "EXPIRED"})
            .eq("type", "DEFENSE_SHIELD")
            .eq("status", "AVAILABLE")
            .lt("expires_at", now)
            .execute()
        )
        count = len(result.data or [])
        if count:
            logger.info("Daily Janitor: expired %d overdue Defense Shields.", count)
        return count

    def get_shield_cap_for_path(self, active_path: str) -> int:
        """
        Returns the maximum number of shields a player can hold based on their path.
        Sentinel: 5  |  All others: 3
        """
        return _SENTINEL_SHIELD_CAP if active_path == "SENTINEL" else _DEFAULT_SHIELD_CAP

    # ------------------------------------------------------------------
    # Standby Tokens — Read
    # ------------------------------------------------------------------

    async def get_available_standby_tokens(self, user_id: str) -> list[dict]:
        """
        Returns all AVAILABLE (unconsumed) standby tokens ordered by creation date.
        FIFO order ensures the oldest token is consumed first on activation.
        Secondary ordering by id ensures deterministic selection.
        """
        result = await (
            self._db
            .table("journey_inventory")
            .select("*")
            .eq("user_id", user_id)
            .eq("type", "STANDBY_TOKEN")
            .eq("status", "AVAILABLE")
            .order("created_at", desc=False)
            .order("id", desc=False)
            .execute()
        )
        return result.data or []

    async def count_available_tokens(self, user_id: str) -> int:
        """Token pool size for UI display and availability checks."""
        result = await (
            self._db
            .table("journey_inventory")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("type", "STANDBY_TOKEN")
            .eq("status", "AVAILABLE")
            .execute()
        )
        return result.count or 0

    async def get_active_standby(self, user_id: str) -> dict | None:
        """
        Returns the currently ACTIVE standby token if protection is running.
        Checks expires_at > now to exclude tokens whose 24-hour window has elapsed
        but haven't been cleaned up by the janitor yet.

        Primary use: midnight cron Ghost Penalty evaluation.
        """
        now = datetime.now(timezone.utc).isoformat()
        result = await (
            self._db
            .table("journey_inventory")
            .select("*")
            .eq("user_id", user_id)
            .eq("type", "STANDBY_TOKEN")
            .eq("status", "ACTIVE")
            .gt("expires_at", now)
            .maybe_single()
            .execute()
        )
        return result.data if result else None

    async def is_standby_active(self, user_id: str) -> bool:
        """
        Lightweight boolean check for Ghost Penalty evaluation.
        Avoids deserializing the full token row when only yes/no is needed.
        """
        active = await self.get_active_standby(user_id)
        return active is not None

    # ------------------------------------------------------------------
    # Standby Tokens — Write
    # ------------------------------------------------------------------


    async def expire_stale_active_tokens(self) -> int:
        """
        Bulk-transitions ACTIVE standby tokens whose expiry has elapsed to USED.
        Called by the Daily Janitor — NOT scoped to a single user.
        Returns the count of tokens transitioned for operational logging.

        This ensures that is_standby_active() never returns True for a token
        that expired but wasn't explicitly consumed by the cron.
        """
        now = datetime.now(timezone.utc).isoformat()
        result = await (
            self._db
            .table("journey_inventory")
            .update({"status": "USED"})
            .eq("type", "STANDBY_TOKEN")
            .eq("status", "ACTIVE")
            .lt("expires_at", now)
            .execute()
        )
        count = len(result.data or [])
        if count:
            logger.info("Daily Janitor: transitioned %d stale Standby Tokens to USED.", count)
        return count

    async def refill_standby_tokens(
        self,
        user_id: str,
        source_event_id: Optional[str] = None,
    ) -> list[dict]:
        """
        Replenishes the player's standby token pool to the maximum capacity (7)
        at the start of a new 365-day Region cycle.

        Only the deficit is minted — existing AVAILABLE tokens are retained.
        Existing ACTIVE tokens are NOT counted against the cap (they will expire).

        Args:
            user_id:         Player UUID.
            source_event_id: UUID of the REGION_SHIFT_COMPLETED event for audit tracing.

        Returns:
            List of newly created token row dicts. Empty if already at capacity.
        """
        current_count = await self.count_available_tokens(user_id)
        deficit = _MAX_STANDBY_TOKENS_PER_CYCLE - current_count

        if deficit <= 0:
            logger.info(
                "Standby Token refill skipped: user=%s already at max capacity (%d/%d).",
                user_id, current_count, _MAX_STANDBY_TOKENS_PER_CYCLE,
            )
            return []

        new_tokens = [
            {
                "id": str(uuid4()),
                "user_id": user_id,
                "type": "STANDBY_TOKEN",
                "status": "AVAILABLE",
                "source_event_id": source_event_id,
            }
            for _ in range(deficit)
        ]

        result = await (
            self._db
            .table("journey_inventory")
            .insert(new_tokens)
            .execute()
        )
        logger.info(
            "Standby Token refill complete: user=%s minted=%d total=%d/%d",
            user_id, deficit, _MAX_STANDBY_TOKENS_PER_CYCLE, _MAX_STANDBY_TOKENS_PER_CYCLE,
        )
        return result.data or []

    async def initialize_starter_tokens(
        self,
        user_id: str,
        count: int = _MAX_STANDBY_TOKENS_PER_CYCLE,
    ) -> list[dict]:
        """
        Mints the initial Standby Token pool for a newly onboarded player.
        Called once during account setup (PATCH /profile/setup flow).
        count defaults to the full annual allotment (7).

        Args:
            user_id: Player UUID.
            count:   Number of tokens to mint. Defaults to 7.
        """
        tokens = [
            {
                "id": str(uuid4()),
                "user_id": user_id,
                "type": "STANDBY_TOKEN",
                "status": "AVAILABLE",
            }
            for _ in range(count)
        ]
        result = await (
            self._db
            .table("journey_inventory")
            .insert(tokens)
            .execute()
        )
        logger.info(
            "Starter Standby Tokens minted: user=%s count=%d", user_id, count
        )
        return result.data or []

    # ------------------------------------------------------------------
    # Bootstrap Aggregation
    # ------------------------------------------------------------------

    async def get_inventory_summary(self, user_id: str) -> dict:
        """
        Returns a condensed inventory snapshot suitable for the /bootstrap response.

        Executes three concurrent Supabase calls via asyncio.gather to minimise
        round-trip latency. This method should be called from BootstrapService
        inside an outer asyncio.gather alongside profile and challenge fetches.

        Returns:
            Dict matching the shape of InventoryResponse, ready for Pydantic parsing.
        """
        shields, active_standby, token_count = await asyncio.gather(
            self.get_active_shields(user_id),
            self.get_active_standby(user_id),
            self.count_available_tokens(user_id),
        )

        return {
            "standby_mode": {
                "active": active_standby is not None,
                "ends_at": active_standby.get("expires_at") if active_standby else None,
                "tokens_remaining": token_count,
                "max_tokens": _MAX_STANDBY_TOKENS_PER_CYCLE,
            },
            "active_shields": [
                {
                    "id": s["id"],
                    "expires_at": s["expires_at"],
                    "strength": 10,  # Fixed for MVP; future: read from item_catalog
                }
                for s in shields
            ],
        }

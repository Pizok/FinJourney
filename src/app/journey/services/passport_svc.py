from __future__ import annotations

import logging
from typing import TYPE_CHECKING
from uuid import UUID

from supabase import AsyncClient

if TYPE_CHECKING:
    from ..engine.bus import EventBus

logger = logging.getLogger(__name__)

# Constants mapping stamp_key to requirement definitions (for reference)
# These map exactly to the 12 stamps in the design plan.
LEVEL_STAMPS = {
    5: "stamp_lvl_5",
    10: "stamp_lvl_10",
    25: "stamp_lvl_25",
    50: "stamp_lvl_50",
    75: "stamp_lvl_75",
    100: "stamp_lvl_100",
}

TX_STAMPS = {
    1: "stamp_tx_1",
    50: "stamp_tx_50",
}

BALANCE_STAMPS = {
    1_000_000: "stamp_bal_1m",
    5_000_000: "stamp_bal_5m",
    10_000_000: "stamp_bal_10m",
    50_000_000: "stamp_bal_50m",
}


class PassportService:
    """
    Evaluates and persists unlocked passport stamps based on user milestones.
    Milestones are permanently unlocked once earned.
    """

    def __init__(self, db: AsyncClient, bus: "EventBus") -> None:
        self.db = db
        self.bus = bus

    async def _grant_stamp(self, user_id: UUID, stamp_key: str) -> None:
        """
        Idempotently inserts a stamp unlock.
        Because milestones are permanent, we use ON CONFLICT DO NOTHING.
        """
        try:
            # Note: The raw SQL in supabase python client does not easily support 
            # ON CONFLICT DO NOTHING via .insert(), so we rely on UPSERT with ignore
            await self.db.table("journey_passport_stamps").upsert(
                {"user_id": str(user_id), "stamp_key": stamp_key},
                on_conflict="user_id, stamp_key",
                ignore_duplicates=True
            ).execute()
        except Exception as e:
            logger.error("Failed to grant stamp %s to user %s: %s", stamp_key, user_id, e)

    async def evaluate_level_stamps(self, user_id: UUID, new_level: int) -> None:
        """
        Evaluates and unlocks level-based stamps.
        Typically called by xp_svc on LEVEL_UP event.
        """
        for required_level, stamp_key in LEVEL_STAMPS.items():
            if new_level >= required_level:
                await self._grant_stamp(user_id, stamp_key)

    async def evaluate_transaction_stamps(self, user_id: UUID) -> None:
        """
        Evaluates and unlocks transaction-based stamps.
        Must query fresh active transaction count to avoid stale cache.
        """
        try:
            # Query active transactions
            res = await self.db.table("transactions").select("id", count="exact").eq("user_id", str(user_id)).eq("status", "active").limit(1).execute()
            count = res.count or 0

            for required_tx, stamp_key in TX_STAMPS.items():
                if count >= required_tx:
                    await self._grant_stamp(user_id, stamp_key)
        except Exception as e:
            logger.error("Failed to evaluate transaction stamps for user %s: %s", user_id, e)

    async def evaluate_balance_stamps(self, user_id: UUID) -> None:
        """
        Evaluates and unlocks net-worth (balance) stamps.
        Queries fresh total wallet balance.
        """
        try:
            res = await self.db.table("wallets").select("balance").eq("user_id", str(user_id)).execute()
            total_balance = sum(float(w.get("balance", 0)) for w in res.data)

            for required_bal, stamp_key in BALANCE_STAMPS.items():
                if total_balance >= required_bal:
                    await self._grant_stamp(user_id, stamp_key)
        except Exception as e:
            logger.error("Failed to evaluate balance stamps for user %s: %s", user_id, e)

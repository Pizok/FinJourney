"""
app/db/queries/savings_targets_queries.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Isolated, read-only query layer for the savings_targets table.

The analytics_service calls get_active_savings_targets() as part of its
asyncio.gather() bundle. The scoring_service then evaluates the first result
(earliest deadline) for:
    • The is_behind_schedule advisory check
    • The SavingsTargetSummary section of the analytics payload

CRUD mutations (create, update, archive) are handled by a dedicated
savings_targets_service and are not present here — this module is strictly
read-only, consistent with the analytics module's read-only boundary.

Required index on savings_targets
──────────────────────────────────
  CREATE INDEX IF NOT EXISTS idx_savings_targets_user_status_deadline
      ON savings_targets (user_id, status, deadline ASC)
      WHERE deleted_at IS NULL;

This partial index covers the exact WHERE + ORDER BY this module uses,
making get_active_savings_targets a single index scan.
"""

from __future__ import annotations

from uuid import UUID
from supabase import AsyncClient

async def get_active_savings_targets(
    db: AsyncClient,
    *,
    user_id: UUID | str,
) -> list[dict]:
    """
    Fetch all active (non-deleted, non-archived) savings targets for the
    given user, ordered strictly by deadline ascending.

    Ordering rationale
    ──────────────────
    The analytics layer surfaces only the single target with the earliest
    deadline (analytics_backend.md § Savings Target Selection). Returning
    all active targets ordered by deadline ASC means the service layer can
    treat index-0 as the priority target without any sorting overhead.
    Returning the full list also lets the CRUD endpoints display the user's
    target queue in priority order without a second query.

    Filter rules
    ────────────
    • status = 'active'         — completed and archived targets are excluded
                                  from the advisory cascade.
    • deleted_at IS NULL        — soft-delete sentinel; a deleted target must
                                  never re-enter analytics calculations.

    Both filters align with the partial index definition above, ensuring
    this query uses an index scan rather than a sequential scan.

    Returns list of Records (may be empty) with keys:
        id               UUID
        name             str
        target_amount    int   — IDR
        current_amount   int   — IDR
        deadline         date
        status           str   — always 'active' for results of this query
        created_at       datetime
    """
    res = await db.table("savings_targets") \
        .select("id, name, target_amount, current_amount, deadline, status, created_at") \
        .eq("user_id", str(user_id)) \
        .eq("status", "active") \
        .is_("deleted_at", "null") \
        .order("deadline", desc=False) \
        .execute()
    
    return res.data or []


async def get_savings_target_by_id(
    db: AsyncClient,
    *,
    user_id: UUID | str,
    target_id: UUID | str,
) -> dict | None:
    """
    Fetch a single savings target by ID, scoped to the authenticated user.

    Used by the CRUD endpoints (GET /savings-targets/{id}, PATCH, soft-DELETE)
    to validate ownership before mutating. The user_id filter enforces the
    same ownership boundary that RLS provides at the database layer,
    providing defence-in-depth.

    Returns None when:
        • The target does not exist.
        • The target belongs to a different user (ownership violation).
        • The target has been soft-deleted (deleted_at IS NOT NULL).

    Returns a dict with all columns on success:
        id, name, target_amount, current_amount, deadline,
        status, created_at, deleted_at
    """
    res = await db.table("savings_targets") \
        .select("id, name, target_amount, current_amount, deadline, status, created_at, deleted_at") \
        .eq("id", str(target_id)) \
        .eq("user_id", str(user_id)) \
        .is_("deleted_at", "null") \
        .execute()
    
    return res.data[0] if res.data else None

"""
account_svc.py
──────────────
Service layer for account lifecycle operations.

Prefix:  /api/v1/account
Domain:  Settings & Account Management
Module:  Account Lifecycle

Two operations live here:

  GET  /export   →  ``export_account_data``
  DELETE /       →  ``delete_account``

Design rules
────────────
  - All user data is owner-scoped; RLS on the Supabase client enforces this
    automatically — no manual user_id filter is required, but we add it
    explicitly as defence-in-depth and to hint the query planner.
  - export_account_data performs three parallel SELECT queries and returns a
    structured JSON payload as a downloadable file.  The export is synchronous
    (not streamed) because the volume of data for an individual user is
    bounded and does not warrant chunked streaming at MVP scale.
  - delete_account calls the Supabase Admin API which deletes the auth.users
    row; cascading FK constraints handle all child table rows automatically.

Export table contract (database.md)
─────────────────────────────────────
  transactions    → financial history (soft-deleted rows excluded)
  journey_events  → alias for game_events — immutable progression ledger
  journey_journal → personal user notes

Deletion cascade contract
─────────────────────────
  Supabase admin.delete_user(user_id) removes auth.users.id.
  All tables referencing profiles.id (which itself references auth.users.id)
  carry ON DELETE CASCADE constraints set in the original schema migration.
  No additional cleanup queries are needed in application code.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from supabase import AsyncClient

from app.schemas.settings_responses import (
    AccountDeleteResponse,
    AccountExportResponse,
    ExportMetadata,
    SettingsErrorEnvelope,
    StandardErrorDetail,
)

_UTC = timezone.utc


# ══════════════════════════════════════════════════════════════════════════════
# Internal helpers
# ══════════════════════════════════════════════════════════════════════════════

async def _fetch_all_transactions(db: AsyncClient, user_id: UUID) -> list[dict[str, Any]]:
    """
    Fetch all non-deleted transaction rows for the user.

    Columns exported mirror the full transactions schema.  Soft-deleted rows
    (is_deleted = true) are excluded — they represent intent-to-delete and
    should not appear in a user-facing data export.
    """
    resp = await (
        db.table("transactions")
        .select("*")
        .eq("user_id",   str(user_id))
        .eq("is_deleted", False)
        .order("logged_at", desc=True)
        .execute()
    )
    return resp.data or []


async def _fetch_all_game_events(db: AsyncClient, user_id: UUID) -> list[dict[str, Any]]:
    """
    Fetch all game_events rows for the user.

    The game_events table is the immutable progression ledger; every row is
    included.  No soft-delete filter applies — the table is append-only.
    """
    resp = await (
        db.table("game_events")
        .select("*")
        .eq("user_id", str(user_id))
        .order("created_at", desc=True)
        .execute()
    )
    return resp.data or []


async def _fetch_all_journal_entries(db: AsyncClient, user_id: UUID) -> list[dict[str, Any]]:
    """
    Fetch all journey_journal rows for the user.

    Journal entries are personal notes; all rows are included regardless of
    any draft / published state.
    """
    resp = await (
        db.table("journey_journal")
        .select("*")
        .eq("user_id", str(user_id))
        .order("created_at", desc=True)
        .execute()
    )
    return resp.data or []


# ══════════════════════════════════════════════════════════════════════════════
# GET /account/export
# ══════════════════════════════════════════════════════════════════════════════

async def export_account_data(
    db:      AsyncClient,
    user_id: UUID,
) -> AccountExportResponse:
    """
    Assemble a full data export for the requesting user.

    Execution
    ─────────
    Three independent SELECT queries run sequentially.  At MVP scale the user's
    data volume is small enough that sequential I/O is acceptable.  If export
    latency becomes a concern, switch to ``asyncio.gather`` — the queries are
    independent and read-only.

    The response is serialised to JSON by the router and returned with a
    Content-Disposition: attachment header so browsers trigger a file download.
    The filename is ``finjourney_export_{user_id[:8]}_{date}.json``.
    """
    transactions,  journey_events, journal_entries = (
        await _fetch_all_transactions(db, user_id),
        await _fetch_all_game_events(db, user_id),
        await _fetch_all_journal_entries(db, user_id),
    )

    meta = ExportMetadata(
        exported_at       = datetime.now(_UTC),
        user_id           = user_id,
        transaction_count = len(transactions),
        event_count       = len(journey_events),
        journal_count     = len(journal_entries),
    )

    return AccountExportResponse(
        meta             = meta,
        transactions     = transactions,
        journey_events   = journey_events,
        journey_journal  = journal_entries,
    )


# ══════════════════════════════════════════════════════════════════════════════
# DELETE /account/
# ══════════════════════════════════════════════════════════════════════════════

class AccountDomainError(Exception):
    """
    Raised when the account deletion operation fails.

    Distinct from SettingsDomainError so the account router can handle it
    separately and return a precise error code.
    """

    def __init__(self, message: str, http_status: int = 500) -> None:
        super().__init__(message)
        self.message     = message
        self.http_status = http_status


async def delete_account(
    admin_db: AsyncClient,
    user_id:  UUID,
) -> AccountDeleteResponse:
    """
    Permanently delete the user's account and all associated data.

    Execution
    ─────────
    1. Call ``admin_db.auth.admin.delete_user(user_id)`` using the service-role
       Supabase client (``admin_db``).  This removes the auth.users row.
    2. Cascading FK constraints (ON DELETE CASCADE) propagate the deletion
       to all child tables: profiles, player_state, transactions, game_events,
       wallets, categories, loans, loan_payments, tasks, achievements,
       user_adventures, user_inventory, region_progress, daily_snapshots, etc.
    3. Return a success acknowledgement.

    Security contract
    ─────────────────
    - ``admin_db`` must be initialised with the Supabase service-role key,
      NOT the anon key.  The dependency ``get_admin_db`` (injected by the
      router) handles this; the service function itself is key-agnostic.
    - The authenticated ``user_id`` is validated by the JWT middleware before
      this function is called; no additional ownership check is needed.
    - This operation is irreversible.  The router requires explicit
      confirmation from the caller (handled at the HTTP layer via a
      ``confirm=true`` query parameter).

    Error handling
    ──────────────
    Supabase admin API errors are caught and re-raised as AccountDomainError
    so the router can return a structured 500 rather than an unhandled
    exception.
    """
    try:
        response = await admin_db.auth.admin.delete_user(str(user_id))

        # supabase-py v2: delete_user raises on failure; a non-None response
        # object with no error attribute indicates success.  Inspect cautiously.
        if hasattr(response, "error") and response.error:
            raise AccountDomainError(
                message     = f"Auth deletion failed: {response.error.message}",
                http_status = 502,
            )

    except AccountDomainError:
        raise
    except Exception as exc:
        raise AccountDomainError(
            message     = f"Unexpected error during account deletion: {exc}",
            http_status = 500,
        ) from exc

    return AccountDeleteResponse()

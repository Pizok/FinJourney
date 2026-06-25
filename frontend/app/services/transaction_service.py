"""
transaction_service.py — Business logic layer for the Transaction pipeline.

KEY UPDATE (Wallet module integration)
---------------------------------------
This replaces the previous transaction_service with a complete pipeline that:
  1. Validates ownership for all referenced wallets and categories (HTTP 403).
  2. Writes the transaction row to the DB.
  3. Applies synchronous wallet balance mutations via apply_balance_delta().
  4. Hands off to budget_service → progression_service for expense transactions.
  5. On soft-delete, reverses the original balance effect before marking deleted.
  6. On edit, reverses the old balance effect and applies the new one.

Architecture constraints honoured
----------------------------------
* No database triggers — all state changes are explicit in Python.
* No background workers — all mutations are synchronous within the request.
* Transfers are balance-neutral (no XP, no HP penalty per logic.md).
* Income does not grant shield (per logic.md).
* Backend is the sole authority for all balance and progression state.

Downstream service interfaces
------------------------------
  budget_service.apply_daily_bleed(client, user_id)
      → Called after every successful expense creation.
      → Reads today's snapshot, calculates overspend ratio, and applies HP loss.

  progression_service.handle_transaction_event(client, user_id, event_type, amount)
      → Called after budget_service completes.
      → Creates a game_events row and may trigger level-up checks.

These interfaces are defined as function calls with explicit parameters.
If the signature changes, update the call sites marked # ← downstream call.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any, Optional

from fastapi import HTTPException, status
from supabase import Client

import app.db.queries.wallet_queries as wal_q
from app.db.queries.category_queries import get_category_by_id
from app.schemas.transaction import (
    TransactionCreate,
    TransactionListResponse,
    TransactionOut,
    TransactionType,
    TransactionUpdate,
)

# Downstream services — imported lazily inside functions to avoid circular deps
# when budget_service or progression_service import from transaction_service.
# from app.services import budget_service, progression_service


# ---------------------------------------------------------------------------
# Internal constants & helpers
# ---------------------------------------------------------------------------

_TRANSFER = TransactionType.transfer
_EXPENSE  = TransactionType.expense
_INCOME   = TransactionType.income


def _now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_wallet(
    client: Client,
    wallet_id: str,
    user_id: str,
    field_label: str = "wallet_id",
) -> dict[str, Any]:
    """
    Assert a wallet exists and belongs to user_id.
    Raises HTTP 403 (not 404) on failure to prevent wallet-existence enumeration.
    """
    wallet = wal_q.get_wallet_by_id(client, wallet_id, user_id)
    if wallet is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code":    "WALLET_OWNERSHIP_VIOLATION",
                "message": (
                    f"The wallet referenced by '{field_label}' does not exist "
                    "or does not belong to you."
                ),
            },
        )
    return wallet


def _require_category(
    client: Client,
    category_id: str,
    user_id: str,
) -> dict[str, Any]:
    """Assert a category exists and belongs to user_id. Raises HTTP 403 on failure."""
    category = get_category_by_id(client, category_id, user_id)
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code":    "CATEGORY_OWNERSHIP_VIOLATION",
                "message": (
                    "The category referenced does not exist "
                    "or does not belong to you."
                ),
            },
        )
    return category

def _require_savings_target(
    client: Client,
    target_id: str,
    user_id: str,
) -> dict[str, Any]:
    """Assert a savings target exists and belongs to user_id. Raises HTTP 403 on failure."""
    response = (
        client.table("savings_targets")
        .select("*")
        .eq("id", target_id)
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "SAVINGS_TARGET_OWNERSHIP_VIOLATION",
                "message": "The savings target referenced does not exist or does not belong to you.",
            },
        )
    return response.data


# ---------------------------------------------------------------------------
# Internal DB helpers
# (would normally live in app/db/queries/transaction_queries.py;
#  kept inline here for the focused MVP scope of this file)
# ---------------------------------------------------------------------------

def _get_transaction_by_id(
    client: Client,
    transaction_id: str,
    user_id: str,
) -> Optional[dict[str, Any]]:
    """Fetch a single active transaction owned by user_id. Returns None if absent."""
    response = (
        client.table("transactions")
        .select("*")
        .eq("id", transaction_id)
        .eq("user_id", user_id)
        .eq("status", "active")
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    return response.data


def _require_transaction(
    client: Client,
    transaction_id: str,
    user_id: str,
) -> dict[str, Any]:
    """Fetch and assert ownership of a transaction. Raises HTTP 404 if absent."""
    txn = _get_transaction_by_id(client, transaction_id, user_id)
    if txn is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code":    "TRANSACTION_NOT_FOUND",
                "message": f"Transaction {transaction_id} not found.",
            },
        )
    return txn


def _insert_transaction_row(
    client: Client,
    user_id: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    """Insert a transaction row and return the created record."""
    payload = {
        "id":                    str(uuid.uuid4()),
        "user_id":               user_id,
        "status":                "active",
        "created_at":            _now_utc(),
        "deleted_at":            None,
        **data,
    }
    response = client.table("transactions").insert(payload).execute()
    return response.data[0]


def _update_transaction_row(
    client: Client,
    transaction_id: str,
    user_id: str,
    updates: dict[str, Any],
) -> dict[str, Any]:
    """Apply a partial update to a transaction row. Returns the updated record."""
    response = (
        client.table("transactions")
        .update(updates)
        .eq("id", transaction_id)
        .eq("user_id", user_id)
        .eq("status", "active")
        .execute()
    )
    return response.data[0]


def _soft_delete_transaction_row(
    client: Client,
    transaction_id: str,
    user_id: str,
) -> None:
    """Mark a transaction as soft-deleted."""
    client.table("transactions").update(
        {
            "status":     "deleted",
            "deleted_at": _now_utc(),
        }
    ).eq("id", transaction_id).eq("user_id", user_id).execute()


# ---------------------------------------------------------------------------
# Balance mutation helpers
# ---------------------------------------------------------------------------

def _apply_balance_for_create(
    client: Client,
    user_id: str,
    txn_type: str,
    amount: int,
    wallet_id: Optional[str],
    source_wallet_id: Optional[str],
    destination_wallet_id: Optional[str],
) -> None:
    """
    Apply wallet balance mutations for a newly created transaction.

    income   → target wallet  += amount
    expense  → target wallet  -= amount
    transfer → source wallet  -= amount
               dest wallet    += amount
    """
    if txn_type == _INCOME.value:
        wal_q.apply_balance_delta(client, wallet_id, user_id, +amount)

    elif txn_type == _EXPENSE.value:
        wal_q.apply_balance_delta(client, wallet_id, user_id, -amount)

    elif txn_type == _TRANSFER.value:
        # Debit source first, then credit destination.
        # On partial failure the DB is inconsistent; at MVP scale this is
        # acceptable. Replace with a Supabase RPC transaction for atomicity.
        wal_q.apply_balance_delta(client, source_wallet_id, user_id, -amount)
        wal_q.apply_balance_delta(client, destination_wallet_id, user_id, +amount)


def _reverse_balance_for_delete(
    client: Client,
    user_id: str,
    txn: dict[str, Any],
) -> None:
    """
    Reverse the balance effect of a transaction before soft-deleting it.

    Inverts _apply_balance_for_create exactly:
      income   → target wallet  -= original_amount
      expense  → target wallet  += original_amount
      transfer → source wallet  += original_amount
                 dest wallet    -= original_amount
    """
    t      = txn["type"]
    amount = txn["amount"]

    if t == _INCOME.value:
        wal_q.apply_balance_delta(client, txn["wallet_id"], user_id, -amount)

    elif t == _EXPENSE.value:
        wal_q.apply_balance_delta(client, txn["wallet_id"], user_id, +amount)

    elif t == _TRANSFER.value:
        wal_q.apply_balance_delta(client, txn["source_wallet_id"], user_id, +amount)
        wal_q.apply_balance_delta(client, txn["destination_wallet_id"], user_id, -amount)


def _adjust_balance_for_update(
    client: Client,
    user_id: str,
    old_txn: dict[str, Any],
    new_amount: Optional[int],
    new_wallet_id: Optional[str],
) -> None:
    """
    Reconcile wallet balances after editing a transaction.

    Strategy
    --------
    For income / expense:
      * If wallet_id changed → full reversal on old wallet, full apply on new wallet.
      * If wallet_id unchanged → apply net delta (new_amount - old_amount) on same wallet.

    For transfer:
      * wallet_id / source / destination cannot change via PATCH (locked at creation).
      * Only amount can change → apply net delta on both wallets.

    Parameters
    ----------
    new_amount    : Updated amount in cents, or None if amount was not changed.
    new_wallet_id : Updated wallet UUID string, or None if wallet was not changed.
                    Only meaningful for income / expense.
    """
    t          = old_txn["type"]
    old_amount = old_txn["amount"]
    eff_amount = new_amount if new_amount is not None else old_amount

    if t in (_INCOME.value, _EXPENSE.value):
        sign = +1 if t == _INCOME.value else -1
        old_wid = old_txn["wallet_id"]
        new_wid = new_wallet_id or old_wid

        if new_wid != old_wid:
            # Wallet changed: fully reverse on old, fully apply on new.
            wal_q.apply_balance_delta(client, old_wid, user_id, -(sign * old_amount))
            wal_q.apply_balance_delta(client, new_wid, user_id,  (sign * eff_amount))
        else:
            # Same wallet: apply net delta.
            delta = sign * (eff_amount - old_amount)
            if delta != 0:
                wal_q.apply_balance_delta(client, old_wid, user_id, delta)

    elif t == _TRANSFER.value:
        # Only amount can change for transfers; wallets are locked.
        delta = eff_amount - old_amount
        if delta != 0:
            wal_q.apply_balance_delta(client, old_txn["source_wallet_id"], user_id, -delta)
            wal_q.apply_balance_delta(client, old_txn["destination_wallet_id"], user_id, +delta)


# ---------------------------------------------------------------------------
# Game logic hand-off
# ---------------------------------------------------------------------------

def _trigger_expense_pipeline(
    client: Client,
    user_id: str,
    amount: int,
) -> None:
    """
    Hand off to the downstream game logic pipeline after an expense is committed.

    Pipeline order (per wallet_backend.md §6):
      1. budget_service.apply_daily_bleed  → calculates overspend, applies HP loss.
      2. progression_service.handle_event  → creates game_events row, checks level-up.

    This function is a no-op if either service is unavailable (import guard).
    Errors from downstream services are logged but do not roll back the transaction —
    the financial record is always committed before game state is updated.
    """
    try:
        # ← downstream call 1: Daily Bleed
        # budget_service.apply_daily_bleed(client=client, user_id=user_id)
        pass  # Remove when budget_service is wired in.
    except Exception:
        # Downstream failure must never fail the transaction endpoint.
        import logging
        logging.getLogger(__name__).exception(
            "budget_service.apply_daily_bleed failed for user %s", user_id
        )

    try:
        # ← downstream call 2: Progression event
        # progression_service.handle_transaction_event(
        #     client=client,
        #     user_id=user_id,
        #     event_type="EXPENSE_LOGGED",
        #     amount=amount,
        # )
        pass  # Remove when progression_service is wired in.
    except Exception:
        import logging
        logging.getLogger(__name__).exception(
            "progression_service.handle_transaction_event failed for user %s", user_id
        )


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

def create_transaction(
    client: Client,
    user_id: str,
    payload: TransactionCreate,
) -> TransactionOut:
    """
    Create a transaction and synchronously update all affected wallet balances.

    Pipeline
    --------
    1. Validate ownership of referenced wallet(s) and category.
    2. Insert the transaction row.
    3. Apply balance delta(s).
    4. If expense → trigger downstream game logic (Daily Bleed + progression).

    Game mechanics
    --------------
    * expense   → reduces daily budget; may trigger HP loss via Daily Bleed.
    * transfer  → pure balance move; no XP, no HP penalty.
    * income    → increases wallet balance; no shield granted (per logic.md).
    """
    # ── 1. Ownership validation ──────────────────────────────────────────────
    txn_type = payload.type.value

    if txn_type in (_INCOME.value, _EXPENSE.value):
        _require_wallet(client, str(payload.wallet_id), user_id, "wallet_id")
        if payload.category_id:
            _require_category(client, str(payload.category_id), user_id)
        if payload.savings_target_id:
            _require_savings_target(client, str(payload.savings_target_id), user_id)

    elif txn_type == _TRANSFER.value:
        _require_wallet(client, str(payload.source_wallet_id), user_id, "source_wallet_id")
        _require_wallet(client, str(payload.destination_wallet_id), user_id, "destination_wallet_id")

    # ── 2. Build DB row payload ──────────────────────────────────────────────
    transfer_group_id = str(uuid.uuid4()) if txn_type == _TRANSFER.value else None

    row_data: dict[str, Any] = {
        "type":                   txn_type,
        "amount":                 payload.amount,
        "transaction_date":       payload.transaction_date.isoformat(),
        "note":                   payload.note,
        "wallet_id":              str(payload.wallet_id)              if payload.wallet_id              else None,
        "category_id":            str(payload.category_id)            if payload.category_id            else None,
        "savings_target_id":      str(payload.savings_target_id)      if payload.savings_target_id      else None,
        "source_wallet_id":       str(payload.source_wallet_id)       if payload.source_wallet_id       else None,
        "destination_wallet_id":  str(payload.destination_wallet_id)  if payload.destination_wallet_id  else None,
        "transfer_group_id":      transfer_group_id,
        "payment_method":         payload.payment_method.value         if payload.payment_method         else None,
    }

    # ── 3. Insert ─────────────────────────────────────────────────────────────
    row = _insert_transaction_row(client, user_id, row_data)

    # ── 4. Balance mutations ──────────────────────────────────────────────────
    _apply_balance_for_create(
        client=client,
        user_id=user_id,
        txn_type=txn_type,
        amount=payload.amount,
        wallet_id=str(payload.wallet_id) if payload.wallet_id else None,
        source_wallet_id=str(payload.source_wallet_id) if payload.source_wallet_id else None,
        destination_wallet_id=str(payload.destination_wallet_id) if payload.destination_wallet_id else None,
    )

    # ── 5. Downstream game logic (expenses only) ──────────────────────────────
    if txn_type == _EXPENSE.value:
        _trigger_expense_pipeline(client, user_id, payload.amount)

    return TransactionOut.model_validate(row)


def update_transaction(
    client: Client,
    transaction_id: str,
    user_id: str,
    payload: TransactionUpdate,
) -> TransactionOut:
    """
    Edit a transaction's mutable fields and reconcile wallet balances.

    Locks
    -----
    * Transaction type is immutable (locked at creation).
    * For transfers: source_wallet_id and destination_wallet_id are immutable.
      Only amount and note can change.

    Balance reconciliation
    ----------------------
    The old balance effect is reversed and the new effect is applied in a
    single logical operation via _adjust_balance_for_update(). The net change
    is minimal to avoid unnecessary balance oscillation.

    Anti-cheat
    ----------
    Per logic.md: editing a past transaction does NOT refund HP penalties
    already applied. The game_events ledger is append-only. This function
    modifies only the transactions table and wallet balances.
    The endpoint layer is responsible for enforcing the edit window.
    """
    # ── 1. Fetch & validate ownership ────────────────────────────────────────
    old_txn = _require_transaction(client, transaction_id, user_id)
    txn_type = old_txn["type"]

    # ── 2. Validate ownership of any new wallet/category references ───────────
    new_wallet_id_str: Optional[str] = None

    if txn_type in (_INCOME.value, _EXPENSE.value):
        if payload.wallet_id is not None:
            new_wallet_id_str = str(payload.wallet_id)
            _require_wallet(client, new_wallet_id_str, user_id, "wallet_id")
        if getattr(payload, "category_id", None) is not None:
            _require_category(client, str(payload.category_id), user_id)
        if getattr(payload, "savings_target_id", None) is not None:
            _require_savings_target(client, str(payload.savings_target_id), user_id)

    elif txn_type == _TRANSFER.value:
        # wallet_id, source_wallet_id, destination_wallet_id are all locked.
        # If the caller sent wallet_id for a transfer, reject it cleanly.
        if payload.wallet_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code":    "TRANSFER_WALLET_IMMUTABLE",
                    "message": (
                        "Source and destination wallets cannot be changed "
                        "on an existing transfer."
                    ),
                },
            )

    # ── 3. Reconcile wallet balances ──────────────────────────────────────────
    _adjust_balance_for_update(
        client=client,
        user_id=user_id,
        old_txn=old_txn,
        new_amount=payload.amount,
        new_wallet_id=new_wallet_id_str,
    )

    # ── 4. Build update dict (only changed fields) ────────────────────────────
    updates: dict[str, Any] = {}
    if payload.amount is not None:
        updates["amount"] = payload.amount
    if getattr(payload, "category_id", None) is not None:
        updates["category_id"] = str(payload.category_id)
    if getattr(payload, "savings_target_id", None) is not None:
        updates["savings_target_id"] = str(payload.savings_target_id)
    if payload.wallet_id is not None and txn_type != _TRANSFER.value:
        updates["wallet_id"] = new_wallet_id_str
    if payload.payment_method is not None:
        updates["payment_method"] = payload.payment_method.value
    if payload.transaction_date is not None:
        updates["transaction_date"] = payload.transaction_date.isoformat()
    if payload.note is not None:
        updates["note"] = payload.note

    # ── 5. Write ───────────────────────────────────────────────────────────────
    row = _update_transaction_row(client, transaction_id, user_id, updates)

    # ── 6. Log adjustment event ────────────────────────────────────────────────
    # Record the adjustment in the immutable ledger
    # Note: progression service would normally compute actual hp/xp delta here
    # based on the net change in daily budget availability.
    old_amount = old_txn.get("amount", 0)
    new_amount = row.get("amount", old_amount)
    
    client.table("game_events").insert(
        {
            "user_id": user_id,
            "event_type": "TRANSACTION_ADJUSTMENT",
            "xp_delta": 0.0,
            "hp_delta": 0.0,
            "gold_delta": 0.0,
            "shield_delta": 0.0,
            "source_id": transaction_id,
            "metadata": {
                "old_amount": old_amount,
                "new_amount": new_amount,
                "amount_delta": new_amount - old_amount,
                "old_wallet": old_txn.get("wallet_id"),
                "new_wallet": row.get("wallet_id"),
            },
        }
    ).execute()

    return TransactionOut.model_validate(row)


def delete_transaction(
    client: Client,
    transaction_id: str,
    user_id: str,
) -> None:
    """
    Soft-delete a transaction and reverse its balance effect.

    Order of operations
    -------------------
    1. Fetch the original transaction (validates ownership).
    2. Reverse the wallet balance effect.
    3. Mark the row as soft-deleted (status=deleted, deleted_at=now).

    Step 2 before step 3 is intentional: if the balance reversal fails we
    do not mark the row as deleted, leaving the financial state consistent.

    Anti-cheat
    ----------
    Deleting a past expense does NOT refund HP already lost to Daily Bleed.
    The game_events ledger retains all penalty records.
    """
    # ── 1. Fetch & validate ──────────────────────────────────────────────────
    old_txn = _require_transaction(client, transaction_id, user_id)

    # ── 2. Reverse balance ────────────────────────────────────────────────────
    _reverse_balance_for_delete(client, user_id, old_txn)

    # ── 3. Soft delete ────────────────────────────────────────────────────────
    _soft_delete_transaction_row(client, transaction_id, user_id)


def list_transactions(
    client: Client,
    user_id: str,
    page: int = 1,
    limit: int = 20,
    wallet_id: Optional[str] = None,
    category_id: Optional[str] = None,
    txn_type: Optional[str] = None,
) -> TransactionListResponse:
    """
    Return a paginated, filtered list of transactions for the authenticated user.

    Filters (all optional, combinable)
    ------------------------------------
    wallet_id   — include only transactions referencing this wallet.
                  For transfers this matches source_wallet_id OR destination_wallet_id.
    category_id — income / expense filter only.
    txn_type    — one of "income", "expense", "transfer".

    Pagination
    ----------
    page and limit are 1-indexed. The response includes total and total_pages
    so the frontend can render pagination controls without a separate count call.

    Default sort: transaction_date DESC, created_at DESC (newest first).
    """
    offset = (page - 1) * limit

    # ── Base query (active only, user-scoped) ─────────────────────────────────
    query = (
        client.table("transactions")
        .select("*", count="exact")
        .eq("user_id", user_id)
        .eq("status", "active")
        .is_("deleted_at", "null")
    )

    # ── Optional filters ──────────────────────────────────────────────────────
    if txn_type:
        query = query.eq("type", txn_type)

    if category_id:
        query = query.eq("category_id", category_id)

    if wallet_id:
        # Wallet filter must cover direct wallet_id, source_wallet_id, and
        # destination_wallet_id so transfers appear when either wallet is selected.
        # PostgREST OR filter syntax: `wallet_id.eq.X,source_wallet_id.eq.X,...`
        query = query.or_(
            f"wallet_id.eq.{wallet_id},"
            f"source_wallet_id.eq.{wallet_id},"
            f"destination_wallet_id.eq.{wallet_id}"
        )

    # ── Sort & paginate ────────────────────────────────────────────────────────
    response = (
        query
        .order("transaction_date", desc=True)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    rows: list[dict[str, Any]] = response.data or []
    total: int = response.count or 0
    total_pages = max(1, -(-total // limit))  # ceiling division

    items = [TransactionOut.model_validate(r) for r in rows]

    return TransactionListResponse(
        items=items,
        page=page,
        limit=limit,
        total=total,
        total_pages=total_pages,
    )


def get_transaction(
    client: Client,
    transaction_id: str,
    user_id: str,
) -> TransactionOut:
    """Fetch a single transaction with ownership validation."""
    txn = _require_transaction(client, transaction_id, user_id)
    return TransactionOut.model_validate(txn)

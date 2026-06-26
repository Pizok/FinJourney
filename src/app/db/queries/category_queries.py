"""
category_queries.py — Database query layer for the `categories` table
and the monthly category-spending aggregation pipeline.

Design notes
------------
* Categories are global per user — not scoped per wallet.
* The category usage aggregation (spent vs. limit) is computed from the
  `transactions` table, filtered to active expenses in the current
  calendar month. This is a Python-side aggregation over two queries;
  acceptable at MVP scale on Supabase Free Tier.
* When a wallet_id filter is active (click-to-filter state on the Wallet
  page), the expense query is additionally filtered by wallet_id so the
  progress bars reflect spending from that wallet only.
* All monetary values are integer cents throughout.

Supabase Free Tier constraints honoured
----------------------------------------
* No triggers.
* No materialized views.
* No GROUP BY via raw RPC (aggregation done in Python).
* Indexed filter columns: user_id, deleted_at, type, transaction_date.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Any, Optional

from supabase import Client


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _now_utc() -> str:
    """Return the current UTC timestamp as an ISO 8601 string for Supabase."""
    return datetime.now(timezone.utc).isoformat()


def _current_month_bounds() -> tuple[str, str]:
    """
    Return ISO 8601 date strings for the first and last day of the current
    calendar month. Used to scope the category spending aggregation.

    Returns
    -------
    (month_start, month_end) — e.g. ("2025-08-01", "2025-08-31")
    """
    today = date.today()
    month_start = today.replace(day=1)

    # Last day: first day of next month minus one day
    if today.month == 12:
        month_end = today.replace(year=today.year + 1, month=1, day=1)
    else:
        month_end = today.replace(month=today.month + 1, day=1)

    from datetime import timedelta
    month_end = month_end - timedelta(days=1)

    return month_start.isoformat(), month_end.isoformat()


def _active_categories_query(client: Client, user_id: str):
    """Base query: all non-deleted categories belonging to user_id."""
    return (
        client.table("categories")
        .select("*")
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
    )


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def get_categories_by_user(client: Client, user_id: str) -> list[dict[str, Any]]:
    """
    Fetch all active (non-deleted) categories for a user.

    Returns
    -------
    list[dict] — ordered by created_at ascending; empty list if none exist.
    """
    response = (
        _active_categories_query(client, user_id)
        .order("created_at", desc=False)
        .execute()
    )
    return response.data or []


def get_category_by_id(
    client: Client,
    category_id: str,
    user_id: str,
) -> Optional[dict[str, Any]]:
    """
    Fetch a single active category by its primary key.

    Returns None if the category does not exist, is soft-deleted,
    or belongs to a different user. Used for ownership validation.
    """
    response = (
        client.table("categories")
        .select("*")
        .eq("id", category_id)
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    return response.data


def get_category_usage(
    client: Client,
    user_id: str,
    wallet_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    """
    Compute per-category spending against monthly limits for the current
    calendar month.

    This is a two-query + Python aggregation pipeline:
      1. Fetch all active categories for the user.
      2. Fetch all active expense transactions within the current calendar
         month (optionally filtered by wallet_id for the click-to-filter state).
      3. Group expenses by category_id in Python and derive
         spent, remaining, percentage, and is_overspent.

    Parameters
    ----------
    wallet_id : If provided, restricts the expense sum to transactions
                executed against this specific wallet. Used when the user
                has selected a wallet filter on the Wallet page.
                None = aggregate across all wallets (default/unfiltered state).

    Returns
    -------
    list[dict] — one entry per active category, matching the CategoryUsage
                 schema. Categories with no transactions this month have
                 spent = 0 and percentage = 0.

    Performance note
    ----------------
    For MVP scale (≤ 10 categories, ≤ ~200 transactions/month per user),
    this Python aggregation is significantly cheaper than a dedicated RPC.
    When user counts justify it, replace step 2–3 with:
        supabase.rpc("get_category_usage", {"p_user_id": user_id, ...})
    """
    # ── Step 1: All active categories ──────────────────────────────────────
    categories = get_categories_by_user(client, user_id)
    if not categories:
        return []

    # ── Step 2: Active expenses for the current calendar month ─────────────
    month_start, month_end = _current_month_bounds()

    expense_query = (
        client.table("transactions")
        .select("category_id, amount")
        .eq("user_id", user_id)
        .eq("type", "expense")
        .eq("status", "active")
        .is_("deleted_at", "null")
        .gte("transaction_date", month_start)
        .lte("transaction_date", month_end)
    )

    if wallet_id is not None:
        expense_query = expense_query.eq("primary_wallet_id", wallet_id)

    expense_response = expense_query.execute()
    expenses: list[dict[str, Any]] = expense_response.data or []

    # ── Step 3: Group expenses by category_id ──────────────────────────────
    spent_by_category: dict[str, int] = defaultdict(int)
    for expense in expenses:
        cid = expense.get("category_id")
        if cid:
            spent_by_category[cid] += expense.get("amount", 0)

    # ── Step 4: Build CategoryUsage rows ────────────────────────────────────
    usage: list[dict[str, Any]] = []

    for cat in categories:
        cat_id: str = str(cat["id"])
        limit: int  = cat.get("monthly_limit", 0)
        spent: int  = spent_by_category.get(cat_id, 0)

        if limit > 0:
            remaining   = max(0, limit - spent)
            percentage  = min(100, round((spent / limit) * 100))
            is_overspent = spent > limit
        else:
            # Uncapped category — no meaningful remaining or percentage
            remaining    = 0
            percentage   = 0
            is_overspent = False

        usage.append(
            {
                "category_id": cat_id,
                "name":        cat["name"],
                "spent":       spent,
                "limit":       limit,
                "remaining":   remaining,
                "percentage":  percentage,
                "is_overspent": is_overspent,
            }
        )

    # Sort: overspent categories first, then by descending spent amount
    usage.sort(key=lambda r: (not r["is_overspent"], -r["spent"]))

    return usage


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

def insert_category(
    client: Client,
    user_id: str,
    name: str,
    monthly_limit: int = 0,
) -> dict[str, Any]:
    """
    Insert a new category row and return the created record.

    Parameters
    ----------
    monthly_limit : Monthly spending cap in integer cents. 0 = uncapped.

    Raises
    ------
    Any Supabase PostgREST exception if the UNIQUE(user_id, name) constraint
    is violated — the service layer catches and converts this to HTTP 409.
    """
    payload: dict[str, Any] = {
        "id":            str(uuid.uuid4()),
        "user_id":       user_id,
        "name":          name,
        "monthly_limit": monthly_limit,
        "created_at":    _now_utc(),
        "deleted_at":    None,
    }

    response = (
        client.table("categories")
        .insert(payload)
        .execute()
    )

    return response.data[0]


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

def update_category(
    client: Client,
    category_id: str,
    user_id: str,
    updates: dict[str, Any],
) -> dict[str, Any]:
    """
    Apply a partial update to a category's mutable fields.

    Mutable fields: `name`, `monthly_limit`.

    The `user_id` ownership predicate is included in the UPDATE itself,
    so a mismatched owner returns an empty result set rather than raising.
    The service layer must verify the returned row is non-null.

    Returns
    -------
    Updated category dict.
    """
    MUTABLE_FIELDS = {"name", "monthly_limit"}
    safe_updates = {k: v for k, v in updates.items() if k in MUTABLE_FIELDS}

    if not safe_updates:
        raise ValueError(
            "No mutable category fields found in updates. "
            f"Allowed: {MUTABLE_FIELDS}"
        )

    response = (
        client.table("categories")
        .update(safe_updates)
        .eq("id", category_id)
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .execute()
    )

    return response.data[0]


# ---------------------------------------------------------------------------
# Soft Delete
# ---------------------------------------------------------------------------

def soft_delete_category(
    client: Client,
    category_id: str,
    user_id: str,
) -> None:
    """
    Soft-delete a category by setting `deleted_at` to the current UTC timestamp.

    Transactions that reference this category_id are NOT affected — historical
    data is preserved (soft-delete + append-only ledger invariant).

    The service layer is responsible for any precondition checks (e.g., warning
    the user that existing transactions reference this category before deletion).
    """
    client.table("categories").update(
        {"deleted_at": _now_utc()}
    ).eq("id", category_id).eq("user_id", user_id).is_("deleted_at", "null").execute()

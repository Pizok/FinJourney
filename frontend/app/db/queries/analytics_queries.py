"""
app/db/queries/analytics_queries.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Isolated, read-only PostgreSQL query layer for the Analytics module.

All GROUP BY aggregations live here — never in Python.
All functions are async and accept an asyncpg Connection as their first
argument. The analytics_service orchestrates concurrent calls via
asyncio.gather(); this module stays pure data-fetching with zero business
logic.

Architecture notes
──────────────────
• Every query filters by user_id first to respect RLS at the app layer.
• Soft-deleted rows are excluded via `deleted_at IS NULL`.
• Granularity strings ('day' / 'month') are derived from a validated enum
  before being interpolated into query strings — they are never raw user input.
• Gap-filling (zero-padding empty time buckets) happens in PostgreSQL with
  generate_series, keeping the Python layer dumb.
• Monetary values are returned as Python int (bigint in PostgreSQL) to avoid
  floating-point drift on IDR amounts.

Required indexes on `transactions` (must exist before deploying analytics)
──────────────────────────────────────────────────────────────────────────
  CREATE INDEX IF NOT EXISTS idx_tx_user_date     ON transactions (user_id, transaction_date);
  CREATE INDEX IF NOT EXISTS idx_tx_user_category ON transactions (user_id, category_id);
  CREATE INDEX IF NOT EXISTS idx_tx_user_status   ON transactions (user_id, deleted_at);
  CREATE INDEX IF NOT EXISTS idx_tx_user_type     ON transactions (user_id, type);
  CREATE INDEX IF NOT EXISTS idx_tx_user_amount   ON transactions (user_id, amount);

Required indexes on supporting tables
──────────────────────────────────────
  CREATE INDEX IF NOT EXISTS idx_snapshots_user_date ON daily_snapshots (user_id, snapshot_date);
  CREATE INDEX IF NOT EXISTS idx_wallets_user        ON wallets (user_id, deleted_at);
  CREATE INDEX IF NOT EXISTS idx_categories_user     ON categories (user_id, deleted_at);
  CREATE INDEX IF NOT EXISTS idx_baselines_user      ON baselines (user_id, deleted_at);
"""

from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

import asyncpg

from app.schemas.analytics import Granularity

# ── Internal constants ────────────────────────────────────────────────────────

_ANALYTICS_REQUIRED_LEVEL: int = 3
_TOP_TRANSACTIONS_LIMIT: int = 5
_CATEGORY_TOP_N: int = 10
_CASHFLOW_MAX_POINTS: int = 365
_DEBT_PROJECTION_LOOKBACK_MONTHS: int = 3

# Map Granularity enum → PostgreSQL DATE_TRUNC unit and TO_CHAR format string.
# These are hardcoded literals — never user-supplied — so f-string
# interpolation below is safe.
_GRANULARITY_MAP: dict[Granularity, tuple[str, str]] = {
    Granularity.DAILY:   ("day",   "YYYY-MM-DD"),
    Granularity.MONTHLY: ("month", "YYYY-MM"),
}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. CASHFLOW SERIES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_cashflow_series(
    db: asyncpg.Connection,
    *,
    user_id: UUID,
    start_date: date,
    end_date: date,
    granularity: Granularity,
    user_tz: str,
) -> list[asyncpg.Record]:
    """
    Return a zero-padded time-series of income and expense totals for the
    requested window.

    Gap-filling is done entirely in PostgreSQL via generate_series so that
    every bucket within [start_date, end_date] appears in the output even
    when the user logged no transactions that day/month. This prevents the
    frontend from having to do date arithmetic.

    Capped at _CASHFLOW_MAX_POINTS (365) rows regardless of window size;
    monthly granularity never reaches this ceiling in practice.

    Timezone handling
    ─────────────────
    transaction_date is stored as DATE in the user's local time (the write
    path applies the timezone offset). AT TIME ZONE is applied in the bucket
    grouping to handle edge cases where a timestamp straddling midnight may
    have been written in UTC; user_tz is passed as a parameter for this
    secondary guard.

    Returns list of Records with keys:
        label   str   — "YYYY-MM-DD" or "YYYY-MM" depending on granularity
        income  int   — total income in IDR for this bucket
        expense int   — total expenses in IDR for this bucket
    """
    trunc_unit, label_fmt = _GRANULARITY_MAP[granularity]

    # Safely interpolated: trunc_unit and label_fmt come from the hardcoded
    # _GRANULARITY_MAP above, never from user input.
    query = f"""
        WITH

        -- Zero-padded series of every time bucket in the requested window.
        -- DATE_TRUNC aligns the start/end to bucket boundaries so partial
        -- months at the edges don't produce an off-by-one.
        series AS (
            SELECT generate_series(
                DATE_TRUNC('{trunc_unit}', $2::date)::date,
                DATE_TRUNC('{trunc_unit}', $3::date)::date,
                '1 {trunc_unit}'::interval
            )::date AS bucket
        ),

        -- Per-bucket income and expense totals from the ledger.
        -- Uses the composite index (user_id, transaction_date).
        agg AS (
            SELECT
                DATE_TRUNC('{trunc_unit}', transaction_date AT TIME ZONE $5)::date
                    AS bucket,
                SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense
            FROM transactions
            WHERE
                user_id          = $1
                AND deleted_at   IS NULL
                AND transaction_date >= $2
                AND transaction_date <= $3
            GROUP BY
                DATE_TRUNC('{trunc_unit}', transaction_date AT TIME ZONE $5)::date
        )

        SELECT
            TO_CHAR(s.bucket, '{label_fmt}')     AS label,
            COALESCE(a.income,  0)::bigint        AS income,
            COALESCE(a.expense, 0)::bigint        AS expense
        FROM   series s
        LEFT JOIN agg a ON a.bucket = s.bucket
        ORDER BY s.bucket ASC
        LIMIT  {_CASHFLOW_MAX_POINTS}
    """

    return await db.fetch(query, user_id, start_date, end_date, granularity.value, user_tz)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. CATEGORY BREAKDOWN
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_category_breakdown(
    db: asyncpg.Connection,
    *,
    user_id: UUID,
    start_date: date,
    end_date: date,
) -> list[asyncpg.Record]:
    """
    Return per-category expense totals for the requested window, with the
    top-10 categories listed individually and all remaining spend aggregated
    into a synthetic "Other" row.

    Both the per-category GROUP BY and the "Other" collapse happen inside
    PostgreSQL:
      1. A ranked CTE assigns ROW_NUMBER ordered by spent DESC.
      2. Rows with rank ≤ 10 are returned as individual named categories.
      3. Rows with rank > 10 are collapsed with SUM() into a single "Other"
         row — suppressed entirely when the residual total is zero.
      4. A UNION ALL joins the two result sets; the final ORDER BY puts the
         "Other" row last regardless of its total.

    Categories are joined via LEFT JOIN so that categories with zero spend
    in the window still appear (with spent = 0) in the ranked CTE. This
    lets the advisory layer detect unused budget capacity.

    Returns list of Records with keys:
        category_id   UUID | None  — None for the synthetic "Other" row
        name          str          — category name or "Other"
        monthly_limit int | None   — monthly budget cap; None for "Other"
        spent         int          — total IDR spent in this window
        is_other      bool         — True only for the synthetic "Other" row
    """
    query = """
        WITH

        -- Per-category GROUP BY with spend ranking.
        ranked AS (
            SELECT
                c.id                                    AS category_id,
                c.name,
                c.monthly_limit,
                COALESCE(SUM(t.amount), 0)::bigint      AS spent,
                ROW_NUMBER() OVER (
                    ORDER BY COALESCE(SUM(t.amount), 0) DESC NULLS LAST
                )                                       AS rnk
            FROM categories c
            LEFT JOIN transactions t
                ON  t.category_id    = c.id
                AND t.user_id        = $1
                AND t.type           = 'expense'
                AND t.deleted_at     IS NULL
                AND t.transaction_date >= $2
                AND t.transaction_date <= $3
            WHERE
                c.user_id            = $1
                AND c.deleted_at     IS NULL
                AND c.category_group = 'expense'
            GROUP BY c.id, c.name, c.monthly_limit
        ),

        -- Top-10 individual categories.
        top_ten AS (
            SELECT
                category_id,
                name,
                monthly_limit,
                spent,
                false AS is_other
            FROM ranked
            WHERE rnk <= $4
        ),

        -- Residual spend collapsed into "Other".
        -- HAVING suppresses the row when all remaining categories have 0 spend.
        other_row AS (
            SELECT
                NULL::uuid   AS category_id,
                'Other'      AS name,
                NULL::bigint AS monthly_limit,
                SUM(spent)   AS spent,
                true         AS is_other
            FROM ranked
            WHERE rnk > $4
            HAVING SUM(spent) > 0
        )

        SELECT category_id, name, monthly_limit, spent, is_other
        FROM   top_ten
        UNION ALL
        SELECT category_id, name, monthly_limit, spent, is_other
        FROM   other_row

        -- Named categories sorted by spend; "Other" always last.
        ORDER BY is_other ASC, spent DESC
    """

    return await db.fetch(query, user_id, start_date, end_date, _CATEGORY_TOP_N)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. TOP TRANSACTIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_top_transactions(
    db: asyncpg.Connection,
    *,
    user_id: UUID,
    start_date: date,
    end_date: date,
) -> list[asyncpg.Record]:
    """
    Fetch the top 5 largest expense transactions within the requested window.

    Joins categories and wallets to resolve human-readable names so the
    service layer receives a flat, display-ready record. This is safe here
    because both joins are indexed FK lookups (not scans).

    Only 'expense' type transactions are included. Transfers and income are
    excluded — they don't represent spending risk.

    Uses the composite index (user_id, amount) for the ORDER BY; the date
    range filter prunes the scan via (user_id, transaction_date).

    Returns list of Records (max 5) with keys:
        id                UUID
        amount            int
        category_name     str
        wallet_name       str
        transaction_date  date
        note              str | None
    """
    query = """
        SELECT
            t.id,
            t.amount::bigint            AS amount,
            c.name                      AS category_name,
            w.name                      AS wallet_name,
            t.transaction_date,
            t.note
        FROM transactions t
        JOIN categories c ON c.id = t.category_id
        JOIN wallets    w ON w.id = t.wallet_id
        WHERE
            t.user_id          = $1
            AND t.type         = 'expense'
            AND t.deleted_at   IS NULL
            AND t.transaction_date >= $2
            AND t.transaction_date <= $3
        ORDER BY t.amount DESC
        LIMIT $4
    """

    return await db.fetch(query, user_id, start_date, end_date, _TOP_TRANSACTIONS_LIMIT)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. MONTHLY DEBT PAYMENTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_monthly_debt_payments(
    db: asyncpg.Connection,
    *,
    user_id: UUID,
    month_date: date,
) -> int:
    """
    Sum all expense transactions in debt-payment categories for the calendar
    month containing month_date.

    Used by the DTI calculation:
        DTI = (monthly_debt_payments / monthly_income) * 100

    DATE_TRUNC('month', ...) on both sides of the comparison ensures the
    filter is index-friendly (no function applied to the column unless
    the index is a functional index on DATE_TRUNC — see the recommended
    index on transaction_date).

    Args:
        month_date: Any date within the target month. Typically today's date
                    when computing the current DTI.

    Returns:
        Total debt-payment spend for the month in IDR. Returns 0 when the
        user has no debt-payment categories or no matching transactions.
    """
    query = """
        SELECT COALESCE(SUM(t.amount), 0)::bigint AS total
        FROM transactions t
        JOIN categories c ON c.id = t.category_id
        WHERE
            t.user_id             = $1
            AND t.type            = 'expense'
            AND t.deleted_at      IS NULL
            AND c.user_id         = $1
            AND c.deleted_at      IS NULL
            AND c.category_type   = 'debt_payment'
            AND DATE_TRUNC('month', t.transaction_date)
                = DATE_TRUNC('month', $2::date)
    """

    row = await db.fetchrow(query, user_id, month_date)
    return int(row["total"]) if row else 0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. AVERAGE MONTHLY DEBT PAYMENTS  (supplementary — required by service layer)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_avg_monthly_debt_payments(
    db: asyncpg.Connection,
    *,
    user_id: UUID,
    lookback_months: int = _DEBT_PROJECTION_LOOKBACK_MONTHS,
) -> int:
    """
    Compute the rolling average of monthly debt-payment spending across the
    last N calendar months (default: 3).

    Required by the Debt-Free Projection algorithm:
        average_monthly_debt_payment = AVG over last 3 months
        projected_months = remaining_debt / average_monthly_debt_payment

    Uses a two-level aggregation:
      1. Inner: SUM per month — produces one row per month.
      2. Outer: AVG over those monthly totals.

    This correctly handles months with zero debt payments (they are included
    as 0 in the average via generate_series gap-filling), preventing the
    projection from being inflated by selectively excluding quiet months.

    Returns:
        Rolling average monthly debt payment in IDR, rounded to the nearest
        integer. Returns 0 when the user has no debt-payment transactions
        in the lookback window, which causes the caller to emit
        debt_free_date_reason = "no_payment_history".
    """
    query = """
        WITH

        -- Generate one row per calendar month in the lookback window
        -- so that months with zero payments contribute 0 to the average.
        month_series AS (
            SELECT generate_series(
                DATE_TRUNC('month', CURRENT_DATE - ($2 || ' months')::interval),
                DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month'),
                '1 month'::interval
            )::date AS month_start
        ),

        -- Per-month debt payment totals from the ledger.
        monthly_totals AS (
            SELECT
                DATE_TRUNC('month', t.transaction_date)::date AS month_start,
                SUM(t.amount)::bigint                          AS total
            FROM transactions t
            JOIN categories c ON c.id = t.category_id
            WHERE
                t.user_id             = $1
                AND t.type            = 'expense'
                AND t.deleted_at      IS NULL
                AND c.user_id         = $1
                AND c.deleted_at      IS NULL
                AND c.category_type   = 'debt_payment'
                AND t.transaction_date >= (
                    CURRENT_DATE - ($2 || ' months')::interval
                )::date
            GROUP BY DATE_TRUNC('month', t.transaction_date)::date
        )

        SELECT
            COALESCE(
                ROUND(AVG(COALESCE(mt.total, 0))),
                0
            )::bigint AS avg_monthly_payment
        FROM   month_series ms
        LEFT JOIN monthly_totals mt ON mt.month_start = ms.month_start
    """

    row = await db.fetchrow(query, user_id, lookback_months)
    return int(row["avg_monthly_payment"]) if row else 0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. WALLET SNAPSHOT  (supplementary — required by service layer)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_wallet_snapshot(
    db: asyncpg.Connection,
    *,
    user_id: UUID,
) -> asyncpg.Record:
    """
    Aggregate all wallet balances into the four analytics dimensions used
    by the asset_health and debt_health sections of the payload.

    Formulas from analytics_backend.md:
        liquid_cash       = SUM(balance) WHERE type IN ('cash', 'bank', 'savings')
        total_credit_bal  = SUM(balance) WHERE type = 'credit'   [may be negative]
        net_liquid_cash   = liquid_cash + total_credit_bal
        invested_assets   = SUM(balance) WHERE type = 'investment'
        active_loans      = COUNT(*) WHERE type = 'credit' AND balance < 0
        remaining_debt    = ABS(SUM(balance)) WHERE type = 'credit' AND balance < 0

    Single-pass CASE aggregation avoids multiple table scans.

    Returns a Record with keys:
        liquid_cash       int   — IDR
        total_credit_bal  int   — IDR (negative means net debt)
        net_liquid_cash   int   — IDR
        invested_assets   int   — IDR
        active_loans      int   — count of wallets with balance < 0
        remaining_debt    int   — IDR (absolute value of negative credit balances)
    """
    query = """
        SELECT
            -- Liquid assets (cash, bank, savings)
            COALESCE(SUM(
                CASE WHEN type IN ('cash', 'bank', 'savings')
                THEN balance ELSE 0 END
            ), 0)::bigint                                   AS liquid_cash,

            -- Credit wallet total (sum of all credit balances; typically ≤ 0)
            COALESCE(SUM(
                CASE WHEN type = 'credit' THEN balance ELSE 0 END
            ), 0)::bigint                                   AS total_credit_bal,

            -- Net liquidity = liquid + credit (reflects credit available or owed)
            COALESCE(SUM(
                CASE WHEN type IN ('cash', 'bank', 'savings', 'credit')
                THEN balance ELSE 0 END
            ), 0)::bigint                                   AS net_liquid_cash,

            -- Investment wallets
            COALESCE(SUM(
                CASE WHEN type = 'investment' THEN balance ELSE 0 END
            ), 0)::bigint                                   AS invested_assets,

            -- Count of credit wallets currently carrying a negative balance
            COUNT(
                CASE WHEN type = 'credit' AND balance < 0 THEN 1 END
            )::int                                          AS active_loans,

            -- Absolute remaining debt principal across all negative credit wallets
            COALESCE(ABS(SUM(
                CASE WHEN type = 'credit' AND balance < 0 THEN balance ELSE 0 END
            )), 0)::bigint                                  AS remaining_debt

        FROM wallets
        WHERE
            user_id    = $1
            AND deleted_at IS NULL
    """

    return await db.fetchrow(query, user_id)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 7. HISTORICAL STABILITY SCORE  (supplementary — required by service layer)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_historical_stability_score(
    db: asyncpg.Connection,
    *,
    user_id: UUID,
    target_date: date,
) -> int | None:
    """
    Fetch the financial_stability_score stored in daily_snapshots for the
    given target_date.

    Used by the scoring_service to compute:
        score_trend = current_score - historical_score

    The target_date is the start of the timeframe window:
        1w  → today - 7 days
        1m  → today - 30 days
        1y  → today - 365 days
        all → earliest available snapshot date

    Returns None when no snapshot exists for that date (e.g. the user had
    not yet signed up, or the snapshot job hadn't run). The scoring_service
    treats None as score_trend = 0.

    Args:
        target_date: The historical anchor date. Caller must resolve this
                     from the timeframe string before calling this function.
    """
    query = """
        SELECT financial_stability_score::int AS score
        FROM   daily_snapshots
        WHERE
            user_id       = $1
            AND snapshot_date = $2
        LIMIT 1
    """

    row = await db.fetchrow(query, user_id, target_date)
    return int(row["score"]) if row else None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 8. ACTIVE BASELINE  (supplementary — required by service layer)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_active_baseline(
    db: asyncpg.Connection,
    *,
    user_id: UUID,
) -> asyncpg.Record | None:
    """
    Fetch the user's most recent non-deleted baseline record.

    The baseline drives:
        • income_allocation.total_income     → baseline.income
        • income_allocation.baseline_costs   → baseline.fixed_costs
        • advisory upcoming_payment check    → liquid_cash < baseline.fixed_costs
        • survival_runway_months             → liquid_cash / (fixed_costs / 30)
        • DTI monthly income denominator     → baseline.income

    Returns None when the user has never completed baseline setup, which
    the service layer maps to has_income: false with all nested values as 0.

    Returns a Record with keys:
        income          int   — monthly income in IDR
        fixed_costs     int   — monthly fixed costs in IDR
        savings_target  int   — monthly savings target in IDR
    """
    query = """
        SELECT
            income::bigint        AS income,
            fixed_costs::bigint   AS fixed_costs,
            savings_target::bigint AS savings_target
        FROM   baselines
        WHERE
            user_id    = $1
            AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
    """

    return await db.fetchrow(query, user_id)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 9. PLAYER ACCESS  (supplementary — required by service layer)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_player_access(
    db: asyncpg.Connection,
    *,
    user_id: UUID,
) -> asyncpg.Record:
    """
    Fetch the player's current XP and compute their level in-database for
    the unlock_status gate.

    Level formula (logic.md):
        level = FLOOR(SQRT(total_xp / 100)) + 1

    Both values are returned so the service can compute:
        unlocked       = current_level >= ANALYTICS_REQUIRED_LEVEL
        xp_remaining   = XP needed to reach the required level (or 0 if unlocked)

    The level is derived here rather than stored (database.md: "total_xp only,
    no stored level") — this is the single computation point.

    Returns a Record with keys:
        total_xp        int  — raw XP value stored in player_state
        current_level   int  — FLOOR(SQRT(total_xp / 100)) + 1
    """
    query = """
        SELECT
            total_xp::bigint                                        AS total_xp,
            (FLOOR(SQRT(total_xp::float / 100.0)) + 1)::int        AS current_level
        FROM player_state
        WHERE user_id = $1
    """

    return await db.fetchrow(query, user_id)

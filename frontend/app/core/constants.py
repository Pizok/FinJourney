"""
app/core/constants.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Single source of truth for cross-module constants.

Import from here — never hardcode these values inside endpoint handlers,
service functions, or query modules. Changing a threshold or adding a new
timeframe should require editing exactly one file.

Sections
────────
  ANALYTICS        — feature gate, timeframe definitions, limits
  TIMEZONE         — fallback and supported zone utilities
  PROGRESSION      — scoring thresholds shared between scoring_service
                     and the endpoint layer
  GAME EVENTS      — event_type string literals for the immutable ledger
  ECONOMY          — DTI limits, overspend thresholds
"""

from __future__ import annotations

from enum import Enum


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ANALYTICS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class Timeframe(str, Enum):
    """
    Valid query window strings accepted by GET /analytics/overview.

    Values match the Pydantic schema Timeframe enum exactly so that
    FastAPI query-parameter coercion and manual string validation
    both use the same canonical set.

    Definition (analytics_backend.md § Timeframe Definitions):
        1w  → current day + previous 6 days  (7 days,  daily granularity)
        1m  → current day + previous 29 days (30 days, daily granularity)
        1y  → current day + previous 364 days (365 days, monthly granularity)
        all → earliest transaction → today   (max 5 years, monthly granularity)
    """

    ONE_WEEK  = "1w"
    ONE_MONTH = "1m"
    ONE_YEAR  = "1y"
    ALL       = "all"


# Set of raw string values — useful for O(1) membership tests in endpoints.
VALID_TIMEFRAMES: frozenset[str] = frozenset(t.value for t in Timeframe)

# Minimum player level required to access the Analytics feature.
# Matches api_contract.md § ANALYTICS and the unlock_status gate in the payload.
ANALYTICS_REQUIRED_LEVEL: int = 3

# Maximum data window for the 'all' timeframe (protects DB resources).
# analytics_backend.md § Read-Only Boundary.
ANALYTICS_MAX_LOOKBACK_YEARS: int = 5

# Hard cap on cashflow series data points returned to the frontend.
# analytics_backend.md § Execution Limits.
ANALYTICS_CASHFLOW_MAX_POINTS: int = 365

# Top-N categories returned individually; the rest collapse into "Other".
ANALYTICS_CATEGORY_TOP_N: int = 10

# Maximum top transactions returned.
ANALYTICS_TOP_TRANSACTIONS_LIMIT: int = 5

# Rolling lookback window for the average monthly debt payment projection.
ANALYTICS_DEBT_LOOKBACK_MONTHS: int = 3

# Payload schema version — bump when AnalyticsOverviewResponse shape changes.
ANALYTICS_PAYLOAD_VERSION: int = 1

# Scoring algorithm version — bump when component weights or formulas change.
ANALYTICS_SCORE_VERSION: int = 1


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TIMEZONE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


# Fallback when profile.timezone is missing or unrecognised.
# WIB (Waktu Indonesia Barat) — the most common timezone for the target market.
# analytics_backend.md § Timezone Rule.
DEFAULT_TIMEZONE: str = "Asia/Jakarta"

# Legacy string fallback used in SQL layer when a POSIX offset is needed
# instead of a named zone. Keep in sync with DEFAULT_TIMEZONE.
DEFAULT_TIMEZONE_POSIX: str = "UTC+7"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PROGRESSION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


# Level formula: level = floor(sqrt(total_xp / 100)) + 1  (logic.md)
# XP required to reach a given level: xp = (level - 1)² × 100
XP_PER_LEVEL_DIVISOR: int = 100

# Minimum level to create additional wallets / categories.
WALLET_CREATION_MIN_LEVEL: int = 3

# Minimum level to create custom tasks.
TASK_CREATION_MIN_LEVEL: int = 2

# Maximum HP damage applied per day from Daily Bleed (logic.md).
HP_DAILY_BLEED_CAP: int = 30

# HP loss per day from Ghost Penalty after 3 days of no transactions.
HP_GHOST_PENALTY_DAILY: int = 10

# Maximum standby tokens available per year.
STANDBY_TOKENS_PER_YEAR: int = 7


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ECONOMY / FINANCIAL THRESHOLDS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


# DTI percentage at which the advisory cascade fires 'critical_debt'.
# Also used as the upper bound for safe_loan_limit calculation.
DTI_CRITICAL_THRESHOLD_PCT: float = 35.0

# Category spend percentage at which 'overspending' advisory fires.
CATEGORY_OVERSPEND_THRESHOLD_PCT: float = 110.0

# Months of liquid cash runway considered "excellent" (full runway score).
RUNWAY_EXCELLENT_MONTHS: float = 6.0

# Upper bound on debt-free projection (months). Projections beyond this
# return debt_free_date=None with reason="projection_exceeds_50_years".
DEBT_PROJECTION_MAX_MONTHS: int = 600


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GAME EVENT TYPE LITERALS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# These string constants map to the event_type column in the game_events table.
# api_contract.md § INTERNAL EVENTS.
# All values are SCREAMING_SNAKE_CASE to match the ledger convention.


class GameEvent(str, Enum):
    """Canonical event_type values for the immutable game_events ledger."""

    DAILY_BLEED    = "DAILY_BLEED"
    CLEAN_CODE     = "CLEAN_CODE"
    GHOST_PENALTY  = "GHOST_PENALTY"
    LEVEL_UP       = "LEVEL_UP"
    BOSS_DEFEATED  = "BOSS_DEFEATED"
    REGION_SHIFT   = "REGION_SHIFT"
    LOAN_CLEARED   = "LOAN_CLEARED"
    STANDBY_USED   = "STANDBY_USED"
    THEME_UNLOCKED = "THEME_UNLOCKED"

    # Analytics-specific event (no HP/XP/gold effects — pure audit).
    BUDGET_REBALANCE = "BUDGET_REBALANCE"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# API CONTRACT HELPERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Standard error codes surfaced in the {"error": {"code": "..."}} envelope.
# Define here so endpoints don't hardcode string literals inline.


class ErrorCode(str, Enum):
    """Standard error code strings for the JSON error envelope."""

    INVALID_TIMEFRAME      = "invalid_timeframe"
    CATEGORY_NOT_FOUND     = "category_not_found"
    INSUFFICIENT_LEVEL     = "insufficient_level"
    INSUFFICIENT_GOLD      = "insufficient_gold"
    WALLET_LIMIT_REACHED   = "wallet_limit_reached"
    CATEGORY_LIMIT_REACHED = "category_limit_reached"
    INVALID_TRANSACTION    = "invalid_transaction"
    FUTURE_TRANSACTION     = "future_transaction"
    DUPLICATE_ZERO_SPEND   = "duplicate_zero_spend"
    STANDBY_EXHAUSTED      = "standby_exhausted"
    OWNERSHIP_VIOLATION    = "ownership_violation"

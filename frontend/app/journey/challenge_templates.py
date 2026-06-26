"""
frontend/app/journey/challenge_templates.py

Central registry for all FinJourney challenge templates.

Each template defines everything the engine needs to:
  - Insert a new row into journey_challenges (via `build_record`)
  - Evaluate progress in handlers.py (via `progress_schema` and `evaluate`)
  - Display challenge info in the frontend (via metadata fields)

Usage
-----
From anywhere in the backend:

    from app.journey.challenge_templates import TEMPLATES, get_template

    # Look up a template
    tpl = get_template("FIRST_STEPS")

    # Build the DB insert payload for a user
    record = tpl.build_record(user_id="some-uuid")

    # Check if a challenge is complete after mutating progress_data
    is_done = tpl.evaluate(progress_data)

Adding a new template
---------------------
1. Define a ChallengeTemplate instance at the bottom of this file.
2. Add it to the TEMPLATES dict.
3. Add the matching handler branch in journey/engine/handlers.py.
   The handler is responsible for mutating progress_data; evaluate()
   tells it whether to call complete_challenge() afterward.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class Reward:
    xp: int = 0
    gold: int = 0
    shield: float = 0.0
    item_type: str | None = None   # matches journey_inventory.type enum if set


@dataclass
class ChallengeTemplate:
    # --- Identity ---
    template_id: str
    title: str
    description: str

    # --- Classification ---
    category: str          # "onboarding" | "habit" | "target" | "endgame"
    difficulty: str        # "easy" | "medium" | "hard" | "legendary"

    # --- Timing ---
    duration_days: int

    # --- Reward on completion ---
    reward: Reward

    # --- Initial state written to journey_challenges.progress_data ---
    initial_progress: dict[str, Any]

    # --- UI hints ---
    icon: str              # Tabler icon name, e.g. "ti-map-2"
    color: str             # Semantic color key consumed by the frontend:
                           # "blue" | "teal" | "amber" | "green" | "purple"
                           # | "coral" | "pink" | "red" | "gray"
                           # Maps to Tailwind classes via CHALLENGE_COLORS in
                           # frontend/components/journey/challenge-card.tsx
    flavor_text: str       # Short in-game lore line shown in the UI

    # --- Trigger hints (informational; actual logic lives in handlers.py) ---
    triggers: list[str] = field(default_factory=list)
    # e.g. ["transaction.logged", "daily.zero_spend_claimed"]

    # --- Auto-assign rule ---
    auto_assign_on: str | None = None
    # e.g. "onboarding_complete" | "level_5" | None (manual/join only)

    # --- Repeatability ---
    repeatable: bool = False

    def build_record(self, user_id: str) -> dict[str, Any]:
        """
        Returns a dict ready to be inserted into journey_challenges.
        Status starts as PREPARING; cron_svc activates it on the next tick.
        """
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            "template_id": self.template_id,
            "status": "PREPARING",
            "started_at": now.isoformat(),
            "ends_at": (now + timedelta(days=self.duration_days)).isoformat(),
            "progress_data": dict(self.initial_progress),   # shallow copy
            "rewards_claimed": False,
        }

    def evaluate(self, progress_data: dict[str, Any]) -> bool:
        """
        Returns True when the challenge goal has been fully met.
        handlers.py calls this after every progress update and then
        calls complete_challenge() if it returns True.

        Each template overrides this via a subclass. The default
        implementation delegates to the _is_complete key in progress_data,
        which handlers.py can set directly for simple all-or-nothing checks.
        """
        return bool(progress_data.get("_is_complete", False))


# ---------------------------------------------------------------------------
# Subclasses with custom evaluate() logic
# ---------------------------------------------------------------------------

class _CounterChallenge(ChallengeTemplate):
    """Completes when progress_data['count'] >= progress_data['target']."""
    def evaluate(self, progress_data: dict[str, Any]) -> bool:
        return progress_data.get("count", 0) >= progress_data.get("target", 1)


class _TaskListChallenge(ChallengeTemplate):
    """Completes when all booleans in progress_data['tasks'] are True."""
    def evaluate(self, progress_data: dict[str, Any]) -> bool:
        tasks = progress_data.get("tasks", {})
        return bool(tasks) and all(tasks.values())


class _AmountChallenge(ChallengeTemplate):
    """Completes when progress_data['amount'] >= progress_data['target_amount']."""
    def evaluate(self, progress_data: dict[str, Any]) -> bool:
        return progress_data.get("amount", 0) >= progress_data.get("target_amount", 1)


class _StreakChallenge(ChallengeTemplate):
    """Completes when progress_data['current_streak'] >= progress_data['target_streak']."""
    def evaluate(self, progress_data: dict[str, Any]) -> bool:
        return (
            progress_data.get("current_streak", 0)
            >= progress_data.get("target_streak", 1)
        )


# ---------------------------------------------------------------------------
# Template definitions
# ---------------------------------------------------------------------------

# 1. FIRST_STEPS
# Triggered automatically after onboarding. Walks new users through
# the four core actions that set up a meaningful FinJourney session.
FIRST_STEPS = _TaskListChallenge(
    template_id="FIRST_STEPS",
    title="First steps",
    description=(
        "Complete your first four financial actions: log an expense, "
        "log an income, create a savings target, and add a wallet."
    ),
    category="onboarding",
    difficulty="easy",
    duration_days=7,
    reward=Reward(xp=200, gold=50),
    initial_progress={
        "tasks": {
            "log_first_expense": False,
            "log_first_income": False,
            "create_savings_target": False,
            "add_wallet": False,
        },
    },
    icon="ti-map-2",
    color="blue",
    flavor_text="Every legend starts somewhere. Yours starts here.",
    triggers=["transaction.logged", "savings_target.created", "wallet.created"],
    auto_assign_on="onboarding_complete",
    repeatable=False,
)


# 2. ZERO_SPEND_WARRIOR
# Pairs directly with the existing zero-spend claim in daily.py.
# Handlers.py increments 'count' whenever zero_spend_xp_claimed fires.
ZERO_SPEND_WARRIOR = _CounterChallenge(
    template_id="ZERO_SPEND_WARRIOR",
    title="Zero-spend warrior",
    description=(
        "Claim 5 zero-spend days within 14 days. "
        "A zero-spend day means no expense transactions logged for that date."
    ),
    category="habit",
    difficulty="easy",
    duration_days=14,
    reward=Reward(xp=300, gold=75, shield=5.0),
    initial_progress={
        "count": 0,
        "target": 5,
        "claimed_dates": [],
    },
    icon="ti-shield-check",
    color="teal",
    flavor_text="The best purchase is the one you didn't make.",
    triggers=["daily.zero_spend_claimed"],
    auto_assign_on=None,
    repeatable=True,
)


# 3. BUDGET_GUARDIAN
# cron_svc.py evaluates this nightly by checking if any category has
# exceeded its monthly_limit in the current month. A breach increments
# 'breach_count'; handlers.py resets 'days_clean' on breach.
BUDGET_GUARDIAN = _StreakChallenge(
    template_id="BUDGET_GUARDIAN",
    title="Budget guardian",
    description=(
        "Stay within every category's monthly limit for 30 consecutive days. "
        "Overspending any single category resets your clean-day streak."
    ),
    category="habit",
    difficulty="medium",
    duration_days=45,
    reward=Reward(xp=500, gold=120, shield=10.0),
    initial_progress={
        "current_streak": 0,
        "target_streak": 30,
        "breach_count": 0,
        "last_evaluated_date": None,
        "breached_categories": [],
    },
    icon="ti-chart-pie",
    color="green",
    flavor_text="A guardian doesn't slip. Not even once.",
    triggers=["daily.budget_check"],
    auto_assign_on=None,
    repeatable=False,
)


# 4. SAVINGS_SPRINT_500K
# handlers.py listens for transaction.logged where savings_target_id is
# not null and accumulates 'amount'. Works across multiple targets.
SAVINGS_SPRINT_500K = _AmountChallenge(
    template_id="SAVINGS_SPRINT_500K",
    title="Savings sprint",
    description=(
        "Contribute a combined total of Rp500,000 toward any savings target "
        "within 30 days."
    ),
    category="target",
    difficulty="easy",
    duration_days=30,
    reward=Reward(xp=350, gold=100),
    initial_progress={
        "amount": 0,
        "target_amount": 500_000,
        "currency": "IDR",
        "transaction_ids": [],
    },
    icon="ti-coin",
    color="amber",
    flavor_text="Small deposits, big destiny.",
    triggers=["transaction.logged"],
    auto_assign_on=None,
    repeatable=True,
)


# 5. SAVINGS_SPRINT_2M
# Harder version of the sprint. Intended for mid-game players (level 5+).
SAVINGS_SPRINT_2M = _AmountChallenge(
    template_id="SAVINGS_SPRINT_2M",
    title="Savings sprint: 2 million",
    description=(
        "Contribute a combined total of Rp2,000,000 toward any savings target "
        "within 45 days."
    ),
    category="target",
    difficulty="medium",
    duration_days=45,
    reward=Reward(xp=750, gold=250),
    initial_progress={
        "amount": 0,
        "target_amount": 2_000_000,
        "currency": "IDR",
        "transaction_ids": [],
    },
    icon="ti-coins",
    color="amber",
    flavor_text="The vault doesn't fill itself.",
    triggers=["transaction.logged"],
    auto_assign_on=None,
    repeatable=True,
)


# 6. DEBT_DESTROYER
# handlers.py identifies loan repayment transactions by checking if the
# transaction's category_group == "debt" OR if there's a matching entry
# in the loans table (by cross-referencing note/amount patterns).
# The safer approach: a dedicated transaction type or a loan_id FK on
# transactions (if added later). For now, category_group is the signal.
DEBT_DESTROYER = _CounterChallenge(
    template_id="DEBT_DESTROYER",
    title="Debt destroyer",
    description=(
        "Make 3 loan repayment transactions within 60 days. "
        "Identified by transactions in the 'debt' category group."
    ),
    category="target",
    difficulty="medium",
    duration_days=60,
    reward=Reward(xp=600, gold=150, shield=15.0),
    initial_progress={
        "count": 0,
        "target": 3,
        "payment_transaction_ids": [],
    },
    icon="ti-credit-card-off",
    color="coral",
    flavor_text="Break the chain. One payment at a time.",
    triggers=["transaction.logged"],
    auto_assign_on=None,
    repeatable=False,
)


# 7. DAILY_TRACKER_14
# handlers.py updates 'current_streak' on any transaction.logged event
# by comparing today's date to 'last_logged_date'. A gap of >1 day resets
# the streak. cron_svc.py checks at midnight whether yesterday had any
# transactions and resets if not (catches users who never logged at all).
DAILY_TRACKER_14 = _StreakChallenge(
    template_id="DAILY_TRACKER_14",
    title="Daily tracker: 14-day streak",
    description=(
        "Log at least one transaction every day for 14 consecutive days. "
        "Missing a single day resets your streak counter."
    ),
    category="habit",
    difficulty="medium",
    duration_days=21,
    reward=Reward(xp=450, gold=100),
    initial_progress={
        "current_streak": 0,
        "best_streak": 0,
        "target_streak": 14,
        "last_logged_date": None,
        "reset_count": 0,
    },
    icon="ti-calendar-check",
    color="blue",
    flavor_text="The habit is the victory.",
    triggers=["transaction.logged", "daily.midnight_check"],
    auto_assign_on=None,
    repeatable=True,
)


# 8. INCOME_DIVERSIFIER
# Encourages users to log income from at least 3 distinct income_streams
# within a calendar month. handlers.py tracks unique source_stream_ids
# seen on income transactions. Completing this reflects healthy financial
# awareness even if total amounts are modest.
INCOME_DIVERSIFIER = _CounterChallenge(
    template_id="INCOME_DIVERSIFIER",
    title="Income diversifier",
    description=(
        "Log income from at least 3 different income streams within 30 days. "
        "Side hustle, salary, freelance — they all count."
    ),
    category="target",
    difficulty="medium",
    duration_days=30,
    reward=Reward(xp=400, gold=90),
    initial_progress={
        "count": 0,
        "target": 3,
        "seen_stream_ids": [],      # deduped list of income_stream UUIDs
    },
    icon="ti-arrows-split-2",
    color="purple",
    flavor_text="One stream is a trickle. Three is a current.",
    triggers=["transaction.logged"],
    auto_assign_on=None,
    repeatable=False,
)


# 9. NET_WORTH_CLIMBER
# Endgame challenge for established players. cron_svc.py calculates net
# worth at the start of the challenge (sum of all wallet balances minus
# total outstanding loan amounts) and stores it in 'baseline_net_worth'.
# Each weekly cron tick snapshots current net worth and appends to
# 'weekly_snapshots'. Completes when current net worth >= baseline + target_delta.
NET_WORTH_CLIMBER = ChallengeTemplate(
    template_id="NET_WORTH_CLIMBER",
    title="Net worth climber",
    description=(
        "Grow your net worth by Rp1,000,000 over 90 days. "
        "Net worth = total wallet balances minus outstanding loan amounts."
    ),
    category="endgame",
    difficulty="hard",
    duration_days=90,
    reward=Reward(xp=1200, gold=400, shield=20.0),
    initial_progress={
        "baseline_net_worth": 0,       # set at assignment time by bootstrap_svc
        "current_net_worth": 0,        # updated by cron weekly
        "target_delta": 1_000_000,
        "currency": "IDR",
        "weekly_snapshots": [],        # list of {date, net_worth} dicts
    },
    icon="ti-trending-up",
    color="green",
    flavor_text="Wealth is built in years. Tracked in days.",
    triggers=["daily.weekly_snapshot"],
    auto_assign_on=None,
    repeatable=False,
)

# Custom evaluate: delta-based, not counter/streak/amount
NET_WORTH_CLIMBER.evaluate = lambda p: (  # type: ignore[method-assign]
    (p.get("current_net_worth", 0) - p.get("baseline_net_worth", 0))
    >= p.get("target_delta", 1)
)


# 10. IRON_BUDGET
# The hardest habit challenge. No HP loss for 60 straight days means
# the user stayed on budget, logged consistently, and avoided all
# penalty-triggering behaviors. handlers.py resets 'clean_days' to 0
# whenever the engine applies a non-zero hp_delta to the user.
# cron_svc.py increments 'clean_days' each midnight where no HP event fired.
IRON_BUDGET = _StreakChallenge(
    template_id="IRON_BUDGET",
    title="Iron budget",
    description=(
        "Survive 60 consecutive days without losing a single HP. "
        "Any budget breach, missed log, or penalty resets your streak."
    ),
    category="endgame",
    difficulty="legendary",
    duration_days=90,
    reward=Reward(xp=2000, gold=750, shield=30.0, item_type="LEGENDARY_SHIELD"),
    initial_progress={
        "current_streak": 0,
        "target_streak": 60,
        "best_streak": 0,
        "reset_count": 0,
        "last_hp_loss_date": None,
    },
    icon="ti-crown",
    color="pink",
    flavor_text="No cracks. No excuses. Iron.",
    triggers=["journey.hp_changed", "daily.midnight_check"],
    auto_assign_on=None,
    repeatable=False,
)


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

TEMPLATES: dict[str, ChallengeTemplate] = {
    t.template_id: t
    for t in [
        FIRST_STEPS,
        ZERO_SPEND_WARRIOR,
        BUDGET_GUARDIAN,
        SAVINGS_SPRINT_500K,
        SAVINGS_SPRINT_2M,
        DEBT_DESTROYER,
        DAILY_TRACKER_14,
        INCOME_DIVERSIFIER,
        NET_WORTH_CLIMBER,
        IRON_BUDGET,
    ]
}


def get_template(template_id: str) -> ChallengeTemplate:
    """
    Returns the ChallengeTemplate for the given ID.
    Raises KeyError if the template doesn't exist — this is intentional
    so callers (handlers.py, assignment endpoints) fail loudly on typos.
    """
    return TEMPLATES[template_id]


def get_templates_for_category(category: str) -> list[ChallengeTemplate]:
    return [t for t in TEMPLATES.values() if t.category == category]


def get_auto_assign_templates(trigger: str) -> list[ChallengeTemplate]:
    """
    Returns all templates that should be auto-assigned when a given
    trigger fires (e.g. 'onboarding_complete').
    """
    return [t for t in TEMPLATES.values() if t.auto_assign_on == trigger]

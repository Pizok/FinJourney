"""
frontend/app/journey/challenge_templates.py

Central registry for all FinJourney challenge templates.

Each template defines everything the engine needs to:
  - Insert a new row into journey_challenges (via `build_record`)
  - Evaluate progress in handlers.py (via `progress_schema` and `evaluate`)
  - Display challenge info in the frontend (via metadata fields)
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
    hp_restore: int = 0
    item_type: str | None = None   # matches journey_inventory.type enum if set
    item_expiry_days: int | None = None


@dataclass
class ChallengeTemplate:
    # --- Identity ---
    template_id: str
    title: str
    description: str

    # --- Classification ---
    category: str          # "onboarding" | "habit" | "target" | "endgame" | "rest"
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
    flavor_text: str       # Short in-game lore line shown in the UI

    # --- Context mapping ---
    # Maps progress_data keys to context dictionary keys provided by assignment_svc.
    context_fields: dict[str, str] | None = None

    # --- Trigger hints (informational; actual logic lives in assignment_svc and handlers.py) ---
    triggers: list[str] = field(default_factory=list)

    # --- Auto-assign rule ---
    auto_assign_on: str | None = None

    # --- Repeatability ---
    repeatable: bool = False

    def build_record(self, user_id: str, context: dict | None = None) -> dict[str, Any]:
        """
        Returns a dict ready to be inserted into journey_challenges.
        Status starts as PREPARING; cron_svc activates it on the next tick.
        """
        now = datetime.now(timezone.utc)
        progress = dict(self.initial_progress)
        
        if context and self.context_fields:
            for field, ctx_key in self.context_fields.items():
                if ctx_key in context:
                    progress[field] = context[ctx_key]

        return {
            "user_id": user_id,
            "template_id": self.template_id,
            "status": "PREPARING",
            "started_at": now.isoformat(),
            "ends_at": (now + timedelta(days=self.duration_days)).isoformat(),
            "progress_data": progress,
            "rewards_claimed": False,
        }

    def evaluate(self, progress_data: dict[str, Any]) -> bool:
        """
        Returns True when the challenge goal has been fully met.
        handlers.py calls this after every progress update and then
        calls complete_challenge() if it returns True.
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
    """Completes when all booleans in progress_data['tasks'] are True and count hits target (if any)."""
    def evaluate(self, progress_data: dict[str, Any]) -> bool:
        tasks = progress_data.get("tasks", {})
        tasks_complete = bool(tasks) and all(tasks.values())
        
        # Some task lists also have a counter (like FIRST_STEPS logging 10 transactions)
        if "target" in progress_data:
            count_complete = progress_data.get("count", 0) >= progress_data.get("target", 1)
            return tasks_complete and count_complete
            
        return tasks_complete


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


class _RestChallenge(ChallengeTemplate):
    """Completes automatically when the time ends without failing."""
    def evaluate(self, progress_data: dict[str, Any]) -> bool:
        # Time-based challenges don't evaluate to True early. They complete when the cron detects ends_at is reached.
        return False


# ---------------------------------------------------------------------------
# Template definitions
# ---------------------------------------------------------------------------

# 1. FIRST_STEPS
FIRST_STEPS = _TaskListChallenge(
    template_id="FIRST_STEPS",
    title="First steps",
    description=(
        "Complete your initial setup: Create a wallet, set a category limit, "
        "and log your first 10 transactions to build the habit."
    ),
    category="onboarding",
    difficulty="easy",
    duration_days=7,
    reward=Reward(xp=250, hp_restore=20),
    initial_progress={
        "tasks": {
            "add_wallet": False,
            "update_category": False,
        },
        "count": 0,
        "target": 10,
    },
    icon="ti-map-2",
    color="blue",
    flavor_text="Every legend starts somewhere. Yours starts here.",
    triggers=["transaction.logged", "wallet.created", "category.updated"],
    auto_assign_on="onboarding_complete",
    repeatable=False,
)

# 2. DEBT_RECOVERY
DEBT_RECOVERY = _TaskListChallenge(
    template_id="DEBT_RECOVERY",
    title="Debt Recovery",
    description="You missed a recent debt payment. Make the catch-up payment within 14 days to stabilize your finances.",
    category="target",
    difficulty="medium",
    duration_days=14,
    reward=Reward(xp=500, hp_restore=50, item_type="STANDBY_TOKEN"),
    initial_progress={
        "tasks": {
            "catch_up_payment_made": False,
        }
    },
    icon="ti-receipt-refund",
    color="red",
    flavor_text="A misstep is not a fall. Recover your balance.",
    triggers=["transaction.logged"],
    repeatable=True,
)

# 3. DEBT_GUARDIAN
DEBT_GUARDIAN = _TaskListChallenge(
    template_id="DEBT_GUARDIAN",
    title="Debt Guardian",
    description="Make all your scheduled loan payments this month without missing a single due date.",
    category="habit",
    difficulty="medium",
    duration_days=30,
    reward=Reward(xp=400, hp_restore=30),
    initial_progress={
        "tasks": {
            "all_payments_made": False,
        }
    },
    icon="ti-shield-lock",
    color="amber",
    flavor_text="Honor your word. Protect your future.",
    triggers=["transaction.logged", "daily.midnight_check"],
    repeatable=True,
)

# 4. SAVINGS_CATCH_UP
SAVINGS_CATCH_UP = _AmountChallenge(
    template_id="SAVINGS_CATCH_UP",
    title="Savings Catch-Up",
    description="You're behind on your savings target this month. Contribute the remaining balance to catch up.",
    category="target",
    difficulty="hard",
    duration_days=14,
    reward=Reward(xp=450, hp_restore=40),
    initial_progress={
        "amount": 0,
        "target_amount": 0,  # Dynamically set
        "currency": "IDR",
    },
    context_fields={
        "target_amount": "remaining_savings_needed"
    },
    icon="ti-trending-up",
    color="teal",
    flavor_text="A slow start makes for a strong finish.",
    triggers=["transaction.logged"],
    repeatable=True,
)

# 5. SAVINGS_CONSISTENCY
SAVINGS_CONSISTENCY = _AmountChallenge(
    template_id="SAVINGS_CONSISTENCY",
    title="Savings Consistency",
    description="Successfully contribute this month's exact target amount to keep your savings on track.",
    category="habit",
    difficulty="medium",
    duration_days=30,
    reward=Reward(xp=400, hp_restore=30, item_type="DEFENSE_SHIELD", item_expiry_days=14),
    initial_progress={
        "amount": 0,
        "target_amount": 0,  # Dynamically set
        "currency": "IDR",
    },
    context_fields={
        "target_amount": "monthly_contribution_target"
    },
    icon="ti-pig-money",
    color="green",
    flavor_text="Consistency is the forge of wealth.",
    triggers=["transaction.logged"],
    repeatable=True,
)

# 6. HP_RECOVERY
HP_RECOVERY = _StreakChallenge(
    template_id="HP_RECOVERY",
    title="HP Recovery",
    description="Your HP is dangerously low. Survive 7 consecutive days without losing any HP to regain a burst of health.",
    category="target",
    difficulty="hard",
    duration_days=10,
    reward=Reward(xp=250, hp_restore=60),
    initial_progress={
        "current_streak": 0,
        "target_streak": 7,
    },
    icon="ti-heart-rate-monitor",
    color="pink",
    flavor_text="Breathe. Stabilize. Endure.",
    triggers=["journey.hp_changed", "daily.midnight_check"],
    repeatable=True,
)

# 7. DAILY_TRACKER
DAILY_TRACKER = _StreakChallenge(
    template_id="DAILY_TRACKER",
    title="Daily Tracker",
    description="Log at least one transaction every day for 14 consecutive days. Missing a day resets your streak.",
    category="habit",
    difficulty="easy",
    duration_days=21,
    reward=Reward(xp=300, hp_restore=15),
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
    repeatable=True,
)

# 8. BUDGET_GUARDIAN
BUDGET_GUARDIAN = _StreakChallenge(
    template_id="BUDGET_GUARDIAN",
    title="Budget Guardian",
    description="Stay within every category's monthly limit for 30 consecutive days. Overspending resets your streak.",
    category="habit",
    difficulty="medium",
    duration_days=45,
    reward=Reward(xp=500, hp_restore=30, item_type="DEFENSE_SHIELD", item_expiry_days=14),
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
    repeatable=True,
)

# 9. IRON_BUDGET
IRON_BUDGET = _StreakChallenge(
    template_id="IRON_BUDGET",
    title="Iron Budget",
    description="Survive 60 consecutive days without losing a single HP. Any penalty resets your streak.",
    category="endgame",
    difficulty="legendary",
    duration_days=90,
    reward=Reward(xp=2000, hp_restore=50, item_type="LEGENDARY_SHIELD", item_expiry_days=14),
    initial_progress={
        "current_streak": 0,
        "target_streak": 60,
        "best_streak": 0,
        "reset_count": 0,
        "last_hp_loss_date": None,
    },
    icon="ti-crown",
    color="purple",
    flavor_text="No cracks. No excuses. Iron.",
    triggers=["journey.hp_changed", "daily.midnight_check"],
    repeatable=True,
)

# 10. REST_AND_RECOVER
REST_AND_RECOVER = _RestChallenge(
    template_id="REST_AND_RECOVER",
    title="Rest & Recover",
    description="Take a 7-day breather. Just log your transactions normally to maintain your streak. Completes automatically.",
    category="rest",
    difficulty="easy",
    duration_days=7,
    reward=Reward(xp=150, hp_restore=10),
    initial_progress={},
    icon="ti-campground",
    color="gray",
    flavor_text="Even heroes need a campfire.",
    triggers=[],
    repeatable=True,
)


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

TEMPLATES: dict[str, ChallengeTemplate] = {
    t.template_id: t
    for t in [
        FIRST_STEPS,
        DEBT_RECOVERY,
        DEBT_GUARDIAN,
        SAVINGS_CATCH_UP,
        SAVINGS_CONSISTENCY,
        HP_RECOVERY,
        DAILY_TRACKER,
        BUDGET_GUARDIAN,
        IRON_BUDGET,
        REST_AND_RECOVER,
    ]
}


def get_template(template_id: str) -> ChallengeTemplate:
    return TEMPLATES[template_id]


def get_templates_for_category(category: str) -> list[ChallengeTemplate]:
    return [t for t in TEMPLATES.values() if t.category == category]


def get_auto_assign_templates(trigger: str) -> list[ChallengeTemplate]:
    return [t for t in TEMPLATES.values() if t.auto_assign_on == trigger]

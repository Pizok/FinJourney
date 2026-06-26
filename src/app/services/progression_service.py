import math


# ── Level ─────────────────────────────────────────────────────────────────────

def calculate_level(total_xp: float) -> int:
    """L = floor(sqrt(XP / 100)) + 1"""
    return int(math.floor(math.sqrt(max(0.0, total_xp) / 100))) + 1


# ── HP state ──────────────────────────────────────────────────────────────────

def is_danger_state(hp: float, max_hp: float = 100.0) -> bool:
    """True when HP is below 30 % — triggers Terracotta UI state."""
    return (hp / max_hp) < 0.30


def is_ghost_penalty_active(days_since_last_tx: int) -> bool:
    """Ghost Penalty fires when no transaction has been logged for 3+ days."""
    return days_since_last_tx >= 3


# ── Feature gates ─────────────────────────────────────────────────────────────

def get_feature_unlocks(level: int) -> dict:
    """
    Level-gated feature map returned in the bootstrap payload.

    Level 1 — base finance engine (wallets, categories, transactions)
    Level 2 — icons, custom tasks, recurring tasks
    Level 3 — analytics, unlimited wallets/categories
    """
    return {
        "can_use_icons": level >= 2,
        "can_create_custom_tasks": level >= 2,
        "can_delete_default_tasks": level >= 2,
        "can_access_analytics": level >= 3,
        "can_create_unlimited_wallets": level >= 3,
        "can_create_unlimited_categories": level >= 3,
    }


# ── XP rewards ────────────────────────────────────────────────────────────────

def xp_for_transaction(tx_type: str) -> float:
    """
    Per logic.md:
      - expense  → 5 XP  (logging discipline)
      - income   → 10 XP (income event)
      - transfer → 0 XP  (transfer moves balance only)
    """
    return {"expense": 5.0, "income": 10.0, "transfer": 0.0}.get(tx_type, 0.0)

from dataclasses import dataclass


# ── Budget ────────────────────────────────────────────────────────────────────

def calculate_daily_budget(
    monthly_income: float,
    fixed_costs: float,
    savings_target: float,
) -> float:
    """(monthly_income − fixed_costs − savings_target) / 30.  Floor-clamped to 0."""
    return max(0.0, (monthly_income - fixed_costs - savings_target) / 30)


# ── Overspend ─────────────────────────────────────────────────────────────────

def overspend_ratio(spent: float, budget: float) -> float:
    """R = max(0, spent − budget) / budget.  Returns 0 if budget ≤ 0."""
    if budget <= 0:
        return 0.0
    return max(0.0, spent - budget) / budget


def calculate_hp_loss(spent: float, budget: float) -> float:
    """HP_loss = min(R × 20, 30).  Daily cap is 30 HP."""
    return min(overspend_ratio(spent, budget) * 20, 30.0)


# ── Shield ────────────────────────────────────────────────────────────────────

def calculate_shield_gain(remaining: float, budget: float) -> float:
    """Shield = min(remaining × 0.25, budget × 0.5).  Only when under budget."""
    if remaining <= 0 or budget <= 0:
        return 0.0
    return min(remaining * 0.25, budget * 0.5)


# ── Bleed application ─────────────────────────────────────────────────────────

@dataclass
class BleedResult:
    overspent: bool
    hp_loss: float          # total raw loss before shield
    shield_consumed: float  # absorbed by shield
    net_hp_damage: float    # actual HP lost after shield
    hp_before: float
    hp_after: float
    new_shield: float


def apply_daily_bleed(
    current_hp: float,
    current_shield: float,
    spent: float,
    budget: float,
) -> BleedResult:
    """
    Consume shield first, then HP.
    Shield acts as a buffer; remaining damage hits HP directly.
    """
    hp_loss = calculate_hp_loss(spent, budget)

    if hp_loss == 0:
        return BleedResult(
            overspent=False,
            hp_loss=0.0,
            shield_consumed=0.0,
            net_hp_damage=0.0,
            hp_before=current_hp,
            hp_after=current_hp,
            new_shield=current_shield,
        )

    shield_consumed = min(current_shield, hp_loss)
    net_hp_damage = hp_loss - shield_consumed
    new_hp = max(0.0, current_hp - net_hp_damage)
    new_shield = max(0.0, current_shield - shield_consumed)

    return BleedResult(
        overspent=True,
        hp_loss=hp_loss,
        shield_consumed=shield_consumed,
        net_hp_damage=net_hp_damage,
        hp_before=current_hp,
        hp_after=new_hp,
        new_shield=new_shield,
    )

from typing import Any
from pydantic import BaseModel


class PlayerStateSchema(BaseModel):
    hp: float
    xp: float
    level: int
    gold: float
    shield: float
    standby_tokens: int
    tax_state: str | None = None


class DailyStatusSchema(BaseModel):
    daily_budget: float
    spent_today: float
    remaining_budget: float
    streak_count: int
    zero_spend_marked: bool


class WalletSchema(BaseModel):
    id: str
    name: str
    icon: str | None = None
    balance: float


class CategorySchema(BaseModel):
    id: str
    name: str
    icon: str | None = None
    category_group: str


class TaskSchema(BaseModel):
    id: str
    title: str
    objective_type: str | None = None
    target_value: float | None = None
    reward_xp: float
    reward_gold: float
    repeat_type: str | None = None
    completed_today: bool
    narrative_text: str | None = None


class FeatureUnlocksSchema(BaseModel):
    can_use_icons: bool
    can_create_custom_tasks: bool
    can_delete_default_tasks: bool
    can_access_analytics: bool
    can_create_unlimited_wallets: bool
    can_create_unlimited_categories: bool


class BootstrapData(BaseModel):
    profile: dict[str, Any]
    player_state: PlayerStateSchema
    daily_status: DailyStatusSchema
    wallets: list[WalletSchema]
    categories: list[CategorySchema]
    tasks: list[TaskSchema]
    active_region: dict[str, Any] | None
    feature_unlocks: FeatureUnlocksSchema

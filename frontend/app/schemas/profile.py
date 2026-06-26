from typing import Literal
from pydantic import BaseModel, field_validator

_AVATAR_CLASSES = ("Sentinel", "Phantom", "Vanguard", "Navigator", "Architect", "Wanderer")


class ProfileSetupRequest(BaseModel):
    username: str
    avatar_class: Literal["Sentinel", "Phantom", "Vanguard", "Navigator", "Architect", "Wanderer"]
    avatar_key: str
    timezone: str

    @field_validator("username")
    @classmethod
    def valid_username(cls, v: str) -> str:
        v = v.strip()
        if not (3 <= len(v) <= 20):
            raise ValueError("Username must be 3–20 characters.")
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username may only contain letters, numbers, - and _.")
        return v


class ProfileThemeRequest(BaseModel):
    theme_key: str


class ProfileOut(BaseModel):
    id: str
    username: str
    avatar_class: str
    avatar_key: str
    level: int
    hp: float
    xp: float
    gold: float
    shield: float
    setup_status: str | None = None
    active_theme: str | None = None

class BaselineEntry(BaseModel):
    id: str
    label: str
    amount: float

class SavingsSetupEntry(BaseModel):
    id: str
    label: str
    target_amount: float
    monthly_contribution: float
    deadline: str

class BaselinesSetupRequest(BaseModel):
    incomeEntries: list[BaselineEntry]
    fixedCostEntries: list[BaselineEntry]
    savingsEntries: list[SavingsSetupEntry]

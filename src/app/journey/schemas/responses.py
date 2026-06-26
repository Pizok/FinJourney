"""
src/backend/journey/models/responses.py

Pydantic v2 response DTOs for the Journey Engine.
Mirrors the database enum types and structures the full /bootstrap payload.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field, computed_field


# ---------------------------------------------------------------------------
# Mirrored Database Enums
# ---------------------------------------------------------------------------


class VitalityState(str, Enum):
    NORMAL = "NORMAL"
    HAZARD = "HAZARD"
    CRITICAL_FAILURE = "CRITICAL_FAILURE"


class PlayerPathID(str, Enum):
    SENTINEL = "SENTINEL"
    VANGUARD = "VANGUARD"
    PHANTOM = "PHANTOM"
    UNASSIGNED = "UNASSIGNED"


class EventSeverity(str, Enum):
    INFO = "INFO"
    SUCCESS = "SUCCESS"
    WARNING = "WARNING"
    DANGER = "DANGER"


class NotificationCategory(str, Enum):
    ACHIEVEMENT = "ACHIEVEMENT"
    HAZARD = "HAZARD"
    CHALLENGE = "CHALLENGE"
    REGION = "REGION"
    SYSTEM = "SYSTEM"
    INVENTORY = "INVENTORY"


class NotificationStatus(str, Enum):
    UNREAD = "UNREAD"
    READ = "READ"
    ARCHIVED = "ARCHIVED"


class ChallengeStatus(str, Enum):
    PREPARING = "PREPARING"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ARCHIVED = "ARCHIVED"


class ItemStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    ACTIVE = "ACTIVE"
    USED = "USED"
    DESTROYED = "DESTROYED"
    EXPIRED = "EXPIRED"


class EventSource(str, Enum):
    USER = "USER"
    SYSTEM = "SYSTEM"
    ENGINE = "ENGINE"


class EventStatus(str, Enum):
    CREATED = "CREATED"
    PROCESSED = "PROCESSED"
    PUBLISHED = "PUBLISHED"
    FAILED = "FAILED"


# ---------------------------------------------------------------------------
# Path Metadata Registry
# ---------------------------------------------------------------------------

_PATH_REGISTRY: dict[PlayerPathID, tuple[str, str]] = {
    PlayerPathID.SENTINEL: (
        "Sentinel",
        "Generate 1 Defense Shield every 7 consecutive clean days. Maximum capacity: 5 shields.",
    ),
    PlayerPathID.VANGUARD: (
        "Vanguard",
        "Income logging grants +10 XP instead of the standard +5. Faster level progression.",
    ),
    PlayerPathID.PHANTOM: (
        "Phantom",
        "Zero-Spend Day grants +15 XP. Ghost Penalty base damage is reduced from 10 HP to 5 HP.",
    ),
    PlayerPathID.UNASSIGNED: (
        "Unassigned",
        "No passive bonus is active. Select a path during onboarding to unlock advantages.",
    ),
}


# ---------------------------------------------------------------------------
# Sub-model: Player State
# ---------------------------------------------------------------------------


class PathInfoResponse(BaseModel):
    """Human-readable descriptor for the player's currently active path."""

    id: PlayerPathID
    name: str
    passive: str

    @classmethod
    def from_path_id(cls, path_id: PlayerPathID) -> "PathInfoResponse":
        name, passive = _PATH_REGISTRY[path_id]
        return cls(id=path_id, name=name, passive=passive)


class PlayerStateResponse(BaseModel):
    """
    Core vitality and progression snapshot.
    Level and XP are always derived server-side — never stored as authoritative
    values on the frontend.
    """

    level: int = Field(ge=1)
    xp: int = Field(ge=0, description="Player's current total XP.")
    xp_needed: int = Field(ge=0, description="XP required to reach the next level.")
    hp: int = Field(ge=0, le=100)
    max_hp: int = Field(default=100)
    vitality: VitalityState
    critical_failure: bool = Field(
        description="True when HP == 0. Certain endpoints return 403 while this is active."
    )
    path: PathInfoResponse
    avatar_key: str = Field(default="Roan", description="Chosen avatar key.")
    current_streak: int = Field(default=0, description="Player's current streak count")


# ---------------------------------------------------------------------------
# Sub-model: Daily Status
# ---------------------------------------------------------------------------


class DailyStatusResponse(BaseModel):
    """Reflects the player's standing within the current 24-hour survival window."""

    safe_daily_budget: int = Field(
        ge=0,
        description="Calculated daily spending ceiling in the user's local currency (IDR).",
    )
    expenses_logged_today: bool
    zero_spend_eligible: bool = Field(
        description="True only if no expenses have been logged in the current day window.",
    )
    ghost_penalty_protected: bool = Field(
        description=(
            "True if the player is in state SAFE_LOGGED, SAFE_CLAIMED, "
            "or has an active Standby Token. False means a Ghost Penalty fires at midnight."
        ),
    )


# ---------------------------------------------------------------------------
# Sub-model: Region Progress
# ---------------------------------------------------------------------------


class RegionProgressResponse(BaseModel):
    """Current macro-environment status within the 365-day annual region cycle."""

    region_id: str = Field(description="Identifier matching an entry in the region_catalog.")
    days_progress: int = Field(ge=0, le=365)
    days_remaining: int = Field(ge=0, le=365)


# ---------------------------------------------------------------------------
# Sub-model: Active Quarterly Challenge
# ---------------------------------------------------------------------------


class WinConditionResponse(BaseModel):
    """A single measurable objective within the active Quarterly Challenge."""

    label: str
    current: int = Field(ge=0, description="Player's current progress toward the target.")
    target: int = Field(gt=0)

    @computed_field  # type: ignore[misc]
    @property
    def progress_ratio(self) -> float:
        """Normalized 0.0–1.0 progress ratio for rendering the UI progress bar."""
        return round(min(self.current / self.target, 1.0), 4)


class ActiveChallengeResponse(BaseModel):
    """Summary of the currently active or recently completed 90-day Quarterly Review."""

    id: UUID
    status: ChallengeStatus
    type: str = Field(
        description="Template identifier, e.g. 'savings_fortress', 'debt_raid'.",
    )
    days_remaining: int = Field(ge=0)
    win_conditions: list[WinConditionResponse] = Field(default_factory=list)
    rewards_claimed: bool = False


# ---------------------------------------------------------------------------
# Sub-model: Inventory
# ---------------------------------------------------------------------------


class ShieldResponse(BaseModel):
    """Represents a single AVAILABLE Defense Shield in the player's inventory."""

    id: UUID
    expires_at: datetime
    strength: int = Field(
        default=10,
        description="HP damage this shield absorbs when destroyed. Fixed at 10 for MVP.",
    )


class StandbyModeResponse(BaseModel):
    """Describes the player's Standby Token pool and current activation state."""

    active: bool
    ends_at: Optional[datetime] = Field(
        default=None,
        description="UTC timestamp when active Standby protection expires. Null if not active.",
    )
    tokens_remaining: int = Field(ge=0, le=7)
    max_tokens: int = Field(default=7)


class InventoryResponse(BaseModel):
    """Aggregated inventory state for the player dashboard."""

    standby_mode: StandbyModeResponse
    active_shields: list[ShieldResponse] = Field(default_factory=list)

    @computed_field  # type: ignore[misc]
    @property
    def shield_count(self) -> int:
        return len(self.active_shields)


# ---------------------------------------------------------------------------
# Sub-model: Journal & Notifications
# ---------------------------------------------------------------------------


class JournalEntryResponse(BaseModel):
    """A single immutable entry from the player's activity log."""

    id: UUID
    date: datetime
    message: str
    severity: EventSeverity


class RecentLogsResponse(BaseModel):
    journal_events: list[JournalEntryResponse] = Field(default_factory=list)


class NotificationItemResponse(BaseModel):
    """A single notification delivered to the player."""

    id: UUID
    category: NotificationCategory
    title: str
    message: str
    severity: EventSeverity
    read: bool
    action_type: Optional[str] = Field(
        default=None,
        description="Frontend routing hint, e.g. 'navigate_to_audit', 'open_challenge'.",
    )
    action_payload: Optional[dict[str, Any]] = None
    created_at: datetime


class NotificationsResponse(BaseModel):
    unread_count: int = Field(ge=0)
    items: list[NotificationItemResponse] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Sub-model: Pending Level-Up Unlocks
# ---------------------------------------------------------------------------


class PendingUnlockResponse(BaseModel):
    """
    A Level-Up feature unlock that has not yet been acknowledged by the client.
    Returned in the bootstrap payload until POST /unlocks/{id}/acknowledge is called.
    """

    id: UUID
    level_reached: int = Field(ge=1)
    feature_key: str = Field(
        description="Machine-readable unlock key, e.g. 'analytics', 'custom_tasks'.",
    )


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Root Response: Bootstrap
# ---------------------------------------------------------------------------


class BootstrapResponse(BaseModel):
    """
    The consolidated hydration payload returned by GET /bootstrap.
    All sub-objects are fetched concurrently in BootstrapService via asyncio.gather.
    This is the single source of truth for the dashboard's initial render.
    """

    player_state: PlayerStateResponse
    daily_status: DailyStatusResponse
    region_progress: RegionProgressResponse
    active_challenge: Optional[ActiveChallengeResponse] = Field(
        default=None,
        description="Null only during the brief PREPARING transition between quarters.",
    )
    inventory: InventoryResponse
    recent_logs: RecentLogsResponse
    notifications: NotificationsResponse
    pending_unlocks: list[PendingUnlockResponse] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Root Response: Journey Overview
# ---------------------------------------------------------------------------

class CurrentRegionResponse(BaseModel):
    id: str
    name: str
    description: str
    progress_days: int
    total_days: int
    days_remaining: int

class JourneyProgressResponse(BaseModel):
    account_days: int
    next_milestone_days: int
    completed_regions: int

class ActiveReviewResponse(BaseModel):
    id: str
    type: str
    title: str
    status: str
    days_remaining: int
    completion_percentage: int
    quarter: str
    win_conditions: list[WinConditionResponse] = Field(default_factory=list)

class PastReviewResponse(BaseModel):
    id: str
    type: str
    title: str
    status: str
    quarter: str
    score: int

class PassportStampResponse(BaseModel):
    id: str
    region: str
    date: str
    challenge: str
    type: str

class PassportLockedResponse(BaseModel):
    id: str
    requirement: str

class PassportResponse(BaseModel):
    stamps_earned: int
    total_available: int
    stamps: list[PassportStampResponse] = Field(default_factory=list)
    locked: list[PassportLockedResponse] = Field(default_factory=list)

class JourneyEventResponse(BaseModel):
    id: str
    type: str
    title: str
    date: str
    xp_change: int
    hp_change: int
    severity: str

class ProfileSnapshotResponse(BaseModel):
    current_hp: int
    total_xp: int
    current_level: int
    vitality: str
    current_streak: int

class JourneyOverviewResponse(BaseModel):
    """
    The full historical and progression data payload returned by GET /overview.
    """
    current_region: Optional[CurrentRegionResponse] = None
    journey_progress: JourneyProgressResponse
    active_review: Optional[ActiveReviewResponse] = None
    past_reviews: list[PastReviewResponse] = Field(default_factory=list)
    passport: PassportResponse
    recent_events: list[JourneyEventResponse] = Field(default_factory=list)
    profile_snapshot: ProfileSnapshotResponse


# ---------------------------------------------------------------------------
# Standard Envelope Wrappers
# ---------------------------------------------------------------------------


class SuccessResponse(BaseModel):
    """Generic success wrapper for simple acknowledgement responses (e.g. 200 OK)."""

    success: bool = True
    data: Optional[dict[str, Any]] = None


class ErrorDetail(BaseModel):
    code: str = Field(description="Machine-readable error code, e.g. 'CRITICAL_FAILURE_ACTIVE'.")
    message: str = Field(description="Human-readable explanation safe to display in the UI.")


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail


# ---------------------------------------------------------------------------
# Domain-Specific Action Responses
# ---------------------------------------------------------------------------


class ZeroSpendClaimResponse(BaseModel):
    """Returned after a successful Zero-Spend claim."""

    player_state: PlayerStateResponse
    daily_status: DailyStatusResponse


class StandbyUseResponse(BaseModel):
    """Returned after a successful Standby Token activation."""

    inventory: InventoryResponse


class PathChangeResponse(BaseModel):
    """Returned after a successful path transition."""

    success: bool = True
    new_path: PlayerPathID
    cooldown_until: datetime


class ReviveResponse(BaseModel):
    """
    Returned after a successful Financial Audit.
    HP is restored to 10 and vitality transitions to HAZARD.
    """

    player_state: PlayerStateResponse


class RewardClaimResponse(BaseModel):
    """Returned after a player claims quarterly challenge rewards."""

    player_state: PlayerStateResponse
    xp_gained: int
    hp_gained: int


class JournalListResponse(BaseModel):
    """Paginated journal response for GET /journal."""

    items: list[JournalEntryResponse]
    total: int
    limit: int
    offset: int


class NotificationListResponse(BaseModel):
    """Paginated notification response for GET /notifications."""

    items: list[NotificationItemResponse]
    unread_count: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Internal Event Record Response (for admin / debugging use)
# ---------------------------------------------------------------------------


class EventRecordResponse(BaseModel):
    """Raw event record shape returned from event_repo queries."""

    id: UUID
    idempotency_key: str
    user_id: UUID
    event_type: str
    event_version: int
    source: EventSource
    severity: EventSeverity
    status: EventStatus
    payload: dict[str, Any]
    error_log: Optional[str] = None
    created_at: datetime
    processed_at: Optional[datetime] = None

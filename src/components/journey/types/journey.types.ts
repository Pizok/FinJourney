// =============================================================================
// journey.types.ts
// Source of truth for all Journey page and Dashboard type definitions.
// Mirrors the API contract defined in api_contract.md and journey_prd.md.
// Frontend NEVER derives progression — all values are server-provided.
// =============================================================================

// ─── Shared Primitives ────────────────────────────────────────────────────────

export type EventSeverity = "success" | "danger" | "info" | "warning" | "milestone";

export type ChallengeType =
  | "boss_fight"
  | "expedition"
  | "survival_challenge"
  | "debt_raid"
  | "savings_fortress"
  | "income_trial";

export type ChallengeStatus = "active" | "completed" | "failed" | "upcoming";

export type TransactionType = "income" | "expense" | "transfer";

export type NotificationType =
  | "ghost_penalty"
  | "daily_bleed"
  | "clean_code"
  | "level_up"
  | "boss_defeated"
  | "region_shift"
  | "loan_cleared"
  | "standby_used"
  | "theme_unlocked";

// ─── Player System ────────────────────────────────────────────────────────────

/**
 * The three available player paths.
 * Path selection is locked for 6 months after the initial setup.
 * UI displays the path name next to the username.
 */
export type PathId = "sentinel" | "catalyst" | "phantom";

export interface PlayerPath {
  /** Stable identifier used for passive rule lookups */
  id: PathId;
  /** Display name shown in the UI */
  name: string;
  /** Short description of the path's passive focus */
  description: string;
}

/**
 * Core progression state. All values are computed and provided by the backend.
 * Frontend MUST NOT derive level, HP, XP, or critical_failure from other values.
 */
export interface PlayerState {
  /** Backend-computed current level (derived from total_xp server-side) */
  level: number;
  /** Current XP within the active level bracket */
  xp: number;
  /** XP required to reach the next level */
  xp_needed: number;
  /** Current HP (0–100). Reaching 0 triggers critical_failure mode */
  hp: number;
  /** Maximum HP ceiling — always 100 in v1 */
  max_hp: number;
  /** When true: XP gain frozen, challenge progression halted */
  critical_failure: boolean;
  /** Chosen player path — affects passive bonuses and UI accents */
  path: PlayerPath;
  /** Chosen avatar key (e.g. 'Roan') */
  avatar_key: string;
  /** Player's current streak */
  current_streak?: number;
}

// ─── Feature Gates ────────────────────────────────────────────────────────────

/**
 * Server-controlled feature gate flags.
 * Frontend renders locked/unlocked states strictly from these values.
 */
export interface FeatureUnlocks {
  /** Requires Level 3 — unlocks /analytics/monthly and trend charts */
  analytics: boolean;
  /** Requires Level 2 — unlocks wallet & category icon pickers */
  icon_customization: boolean;
  /** Requires Level 3 — removes wallet/category creation limits */
  unlimited_wallets: boolean;
}

// ─── Daily Status ─────────────────────────────────────────────────────────────

/**
 * Snapshot of today's financial and protection state.
 * Recalculated by the backend on each snapshot event (00:00 local timezone).
 */
export interface DailyStatus {
  /** Today's safe spending ceiling — the hero metric on the dashboard */
  safe_daily_budget: number;
  /** True if at least one expense transaction exists today */
  expenses_logged_today: boolean;
  /** False if an expense already exists (Zero-Spend button blocked) */
  zero_spend_eligible: boolean;
  /** True if standby mode is active or zero-spend was claimed today */
  ghost_penalty_protected: boolean;
}

// ─── Region System ────────────────────────────────────────────────────────────

/**
 * Lightweight region summary used in the bootstrap payload and dashboard.
 * Detailed region data (artwork, description, milestones) is fetched
 * lazily via GET /api/v1/journey/regions/{region_id}.
 */
export interface RegionProgress {
  /** Stable key used to look up local artwork and assets */
  region_id: string;
  /** Human-readable region name */
  name: string;
  /** Number of account_days elapsed in the current region */
  days_progress: number;
  /** Number of account_days remaining before the region shift */
  days_remaining: number;
}

/**
 * Full region detail — returned by the lazy region modal endpoint.
 * Extends the summary with description, total_days, and milestone data.
 */
export interface RegionDetail extends RegionProgress {
  /** Narrative description rendered in the region detail modal */
  description: string;
  /** Fixed cycle length — always 365 in v1 */
  total_days: number;
  /** ISO date string when the user entered this region */
  entered_at: string;
  /** Milestones earned within this region */
  milestones_earned: number;
}

// ─── Challenge / Quarterly Review System ─────────────────────────────────────

/** A single objective within a quarterly review or active challenge */
export interface WinCondition {
  /** Human-readable goal label (e.g., "Save Rp1.000.000") */
  label: string;
  /** Current measured value — server-provided, never calculated client-side */
  current: number;
  /** Target threshold that satisfies the condition */
  target: number;
}

/**
 * Dashboard summary of the current active challenge.
 * Displayed in Row 2 of the dashboard layout.
 */
export interface ActiveChallenge {
  status: ChallengeStatus;
  type: ChallengeType;
  title: string;
  days_remaining: number;
  win_conditions: WinCondition[];
}

/**
 * Full quarterly review record — used in both the Journey page
 * review list and the ReviewDetailModal.
 */
export interface QuarterlyReview {
  id: string;
  type: ReviewType;
  title: string;
  status: ReviewStatus;
  /** Present only when status is "active" */
  days_remaining?: number;
  /** 0–100, present only when status is "active" */
  completion_percentage?: number;
  /** Quarter label, e.g., "Q1" */
  quarter?: string;
  /** Final performance score, present only when status is "completed" */
  score?: number;
  /** Full objective list — present in detail view only */
  win_conditions?: WinCondition[];
}

export type ReviewType = ChallengeType;
export type ReviewStatus = ChallengeStatus;

// ─── Inventory System ─────────────────────────────────────────────────────────

/** Standby mode state — prevents ghost penalties and streak decay for 24h */
export interface StandbyMode {
  /** Whether standby mode is currently active */
  active: boolean;
  /** ISO timestamp when the current standby session ends */
  ends_at: string;
  /** Remaining uses this year (replenished annually) */
  tokens_remaining: number;
  /** Maximum yearly allocation — always 7 in v1 */
  max_tokens: number;
}

/** A single active defense shield */
export interface ActiveShield {
  id: string;
  /** ISO timestamp when this shield expires */
  expires_at: string;
  /** Shield strength — damage absorbed before HP is hit */
  strength: number;
}

/** Player inventory snapshot */
export interface Inventory {
  standby_mode: StandbyMode;
  active_shields: ActiveShield[];
}

// ─── Journal & Notification System ───────────────────────────────────────────

/** A single narrative event from the immutable game_events ledger */
export interface JournalEvent {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Short narrative message rendered in the Latest Event Preview */
  message: string;
  severity: EventSeverity;
  /** Signed XP delta — positive for rewards, negative for penalties */
  xp_change: number;
  /** Signed HP delta — positive for recovery, negative for damage */
  hp_change: number;
}

export interface RecentLogs {
  /** Up to 30 most recent events — full history fetched via Journey page */
  journal_events: JournalEvent[];
}

/** A single actionable notification item */
export interface Notification {
  id: string;
  type: NotificationType;
  severity: EventSeverity;
  title: string;
  message: string;
  /** ISO timestamp */
  created_at: string;
  read: boolean;
}

export interface Notifications {
  unread_count: number;
  /** Ordered newest-first */
  items: Notification[];
}

// ─── Analytics ───────────────────────────────────────────────────────────────

/**
 * Analytics snippet for dashboard preview.
 * When locked (user < Level 3) the frontend renders a blurred placeholder.
 * Full data available at GET /api/v1/analytics/monthly (Level 3+).
 */
export interface AnalyticsSnippets {
  locked: boolean;
  required_level: number;
  /** Present only when locked === false */
  income?: number;
  expense?: number;
  savings_rate?: number;
  budget_accuracy?: number;
}

// ─── Bootstrap Payload ────────────────────────────────────────────────────────

/**
 * Complete payload returned by GET /api/v1/journey/bootstrap.
 * This is the single hydration call made after login / on dashboard mount.
 * MUST NOT contain full transaction histories or historical journal arrays.
 */
export interface BootstrapPayload {
  player_state: PlayerState;
  feature_unlocks: FeatureUnlocks;
  daily_status: DailyStatus;
  region_progress: RegionProgress;
  active_challenge: ActiveChallenge | null;
  inventory: Inventory;
  recent_logs: RecentLogs;
  notifications: Notifications;
  analytics_snippets: AnalyticsSnippets;
}

// ─── Journey Page Types ───────────────────────────────────────────────────────

/**
 * Extended region data used in the Journey page — includes full_days
 * for the timeline calculation and narrative description.
 */
export interface CurrentRegion {
  id: string;
  name: string;
  /** Narrative description — rendered in RegionOverview and RegionDetailModal */
  description?: string;
  progress_days: number;
  total_days: number;
  days_remaining: number;
}

/** High-level account progression summary */
export interface JourneyProgress {
  /** Total number of account_days since onboarding */
  account_days: number;
  /** Days until the next progression milestone node */
  next_milestone_days: number;
  /** Number of fully completed region cycles */
  completed_regions: number;
}

/** Passport stamp — earned by completing region cycles and challenges */
export interface PassportStamp {
  id: string;
  /** Name of the region where the stamp was earned */
  region: string;
  /** Human-readable date label, e.g., "Oct 2025" */
  date: string;
  /** Challenge or milestone that triggered the stamp */
  challenge: string;
  /** "active" = in current region, "completed" = past region */
  type: "completed" | "active";
}

/** A locked passport slot shown as a placeholder in the Passport section */
export interface LockedStamp {
  id: string;
  /** Requirement text shown in the locked slot, e.g., "Reach Level 5" */
  requirement: string;
}

export interface Passport {
  stamps_earned: number;
  total_available: number;
  stamps: PassportStamp[];
  locked: LockedStamp[];
}

/** A single entry in the Journey History timeline */
export interface HistoryEvent {
  id: string;
  type: "achievement" | "penalty" | "milestone" | "task" | "hazard" | "region";
  title: string;
  /** Human-readable date label, e.g., "Jun 1, 2026" */
  date: string;
  xp_change: number;
  hp_change: number;
  severity: EventSeverity;
}

/**
 * Primary payload returned by GET /api/v1/journey/overview.
 * Hydrates the entire Journey page in a single request.
 * staleTime: 60 seconds per TanStack Query strategy.
 */
export interface JourneyOverview {
  current_region: CurrentRegion;
  journey_progress: JourneyProgress;
  active_review: QuarterlyReview | null;
  past_reviews: QuarterlyReview[];
  passport: Passport;
  recent_events: HistoryEvent[];
}

/** Paginated history response for infinite scroll */
export interface HistoryPage {
  events: HistoryEvent[];
  /** null when no further pages exist */
  next_page: number | null;
  total: number;
}

// ─── Modal State ──────────────────────────────────────────────────────────────

export type ModalKind = "region" | "review" | "stamp" | null;

export interface RegionModalPayload {
  kind: "region";
  regionId: string;
  /** Optimistic summary from already-loaded data — avoids blank modal flash */
  summary: CurrentRegion;
}

export interface ReviewModalPayload {
  kind: "review";
  reviewId: string;
  summary: QuarterlyReview;
}

export interface StampModalPayload {
  kind: "stamp";
  stamp: PassportStamp;
}

export type ModalPayload =
  | RegionModalPayload
  | ReviewModalPayload
  | StampModalPayload
  | null;

// ─── API Response Wrapper ─────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── TanStack Query Key Factories ─────────────────────────────────────────────

export const JOURNEY_QUERY_KEYS = {
  all: ["journey"] as const,
  bootstrap: () => ["journey", "bootstrap"] as const,
  overview: () => ["journey", "overview"] as const,
  region: (id: string) => ["journey", "region", id] as const,
  review: (id: string) => ["journey", "review", id] as const,
  history: () => ["journey", "history"] as const,
} as const;

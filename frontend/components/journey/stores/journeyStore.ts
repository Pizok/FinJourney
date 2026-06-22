// =============================================================================
// journeyStore.ts
// Zustand store for Journey page UI state and mock development data.
//
// Responsibilities:
//   - Modal open/close coordination (RegionDetailModal, ReviewDetailModal, PassportModal)
//   - Notification read state
//   - Bootstrap and overview data hydration (used when TanStack Query is offline)
//
// Data fetching authority:
//   TanStack Query is the primary data layer. This store is NOT a data cache.
//   It holds UI state only, plus mock data for isolated development.
//
// Backend authority rule:
//   This store NEVER computes level, HP, XP, shield, or any game mechanic.
//   All progression values arrive from the server unchanged.
// =============================================================================

import { create } from "zustand";
import { useShallow } from "zustand/shallow";
import { devtools } from "zustand/middleware";
import type {
  BootstrapPayload,
  JourneyOverview,
  ModalPayload,
  CurrentRegion,
  QuarterlyReview,
  PassportStamp,
} from "../types/journey.types";

// ─── Mock Data ────────────────────────────────────────────────────────────────
// Mirrors the exact shape of the API responses defined in api_contract.md.
// Used for local development before the backend is connected.
// Replace with real TanStack Query fetches when the API is available.

export const MOCK_BOOTSTRAP: BootstrapPayload = {
  player_state: {
    level: 2,
    xp: 520,
    xp_needed: 700,
    hp: 67,
    max_hp: 100,
    critical_failure: false,
    path: {
      id: "sentinel",
      name: "Sentinel",
      description: "Defensive focus. Shield bonuses on under-budget days.",
    },
  },
  feature_unlocks: {
    analytics: false,
    icon_customization: true,
    unlimited_wallets: false,
  },
  daily_status: {
    safe_daily_budget: 250_000,
    expenses_logged_today: true,
    zero_spend_eligible: false,
    ghost_penalty_protected: true,
  },
  region_progress: {
    region_id: "quiet_valley",
    name: "The Quiet Valley",
    days_progress: 273,
    days_remaining: 92,
  },
  active_challenge: {
    status: "active",
    type: "savings_fortress",
    title: "Build the Fortress",
    days_remaining: 12,
    win_conditions: [
      { label: "Save Rp1.000.000", current: 450_000, target: 1_000_000 },
      { label: "Stay under budget 7 days", current: 4, target: 7 },
      { label: "Complete 5 daily tasks", current: 3, target: 5 },
    ],
  },
  inventory: {
    standby_mode: {
      active: true,
      ends_at: "2026-06-03T23:59:59Z",
      tokens_remaining: 4,
      max_tokens: 7,
    },
    active_shields: [
      {
        id: "shield-001",
        expires_at: "2026-06-06T10:00:00Z",
        strength: 10,
      },
      {
        id: "shield-002",
        expires_at: "2026-06-08T00:00:00Z",
        strength: 5,
      },
    ],
  },
  recent_logs: {
    journal_events: [
      {
        date: "2026-06-01",
        message: "Stayed under budget",
        severity: "success",
        xp_change: 10,
        hp_change: 0,
      },
      {
        date: "2026-05-28",
        message: "Ghost Penalty applied — 3 days without a transaction",
        severity: "danger",
        xp_change: 0,
        hp_change: -10,
      },
      {
        date: "2026-05-25",
        message: "Day 270 milestone reached",
        severity: "milestone",
        xp_change: 50,
        hp_change: 0,
      },
    ],
  },
  notifications: {
    unread_count: 1,
    items: [
      {
        id: "notif-001",
        type: "ghost_penalty",
        severity: "danger",
        title: "Ghost Penalty Applied",
        message: "You lost 10 HP due to 3 days of inactivity.",
        created_at: "2026-06-01T08:00:00Z",
        read: false,
      },
      {
        id: "notif-002",
        type: "clean_code",
        severity: "success",
        title: "Under Budget — Day Streak",
        message: "You stayed under budget. +10 XP awarded.",
        created_at: "2026-06-01T23:59:00Z",
        read: true,
      },
    ],
  },
  analytics_snippets: {
    locked: true,
    required_level: 3,
  },
};

export const MOCK_JOURNEY_OVERVIEW: JourneyOverview = {
  current_region: {
    id: "quiet_valley",
    name: "The Quiet Valley",
    description:
      "A contemplative stretch of steady habits and measured discipline. Here, the path rewards patience over impulse. The valley is calm — but the next region shift looms on the horizon.",
    progress_days: 273,
    total_days: 365,
    days_remaining: 92,
  },
  journey_progress: {
    account_days: 273,
    next_milestone_days: 17,
    completed_regions: 2,
  },
  active_review: {
    id: "review-003",
    type: "savings_fortress",
    title: "Build the Fortress",
    status: "active",
    days_remaining: 12,
    completion_percentage: 45,
    quarter: "Q3",
    win_conditions: [
      { label: "Save Rp1.000.000", current: 450_000, target: 1_000_000 },
      { label: "Stay under budget 7 days", current: 4, target: 7 },
      { label: "Complete 5 daily tasks", current: 3, target: 5 },
    ],
  },
  past_reviews: [
    {
      id: "review-001",
      type: "boss_fight",
      title: "The First Reckoning",
      status: "completed",
      quarter: "Q1",
      score: 78,
    },
    {
      id: "review-002",
      type: "expedition",
      title: "The Long March",
      status: "completed",
      quarter: "Q2",
      score: 91,
    },
  ],
  passport: {
    stamps_earned: 3,
    total_available: 12,
    stamps: [
      {
        id: "stamp-001",
        region: "Iron Plains",
        date: "Oct 2025",
        challenge: "Debt Clearance",
        type: "completed",
      },
      {
        id: "stamp-002",
        region: "Silent Coast",
        date: "Jan 2026",
        challenge: "Emergency Fund",
        type: "completed",
      },
      {
        id: "stamp-003",
        region: "The Quiet Valley",
        date: "Apr 2026",
        challenge: "Q1 Review",
        type: "active",
      },
    ],
    locked: [
      { id: "lock-001", requirement: "Complete Region 4" },
      { id: "lock-002", requirement: "Reach Level 5" },
      { id: "lock-003", requirement: "Complete Q3 Review" },
      { id: "lock-004", requirement: "Reach Level 7" },
      { id: "lock-005", requirement: "Complete Region 5" },
      { id: "lock-006", requirement: "100-Day Streak" },
      { id: "lock-007", requirement: "Complete Boss Fight" },
      { id: "lock-008", requirement: "Reach Level 10" },
      { id: "lock-009", requirement: "Complete the Journey" },
    ],
  },
  recent_events: [
    {
      id: "evt-001",
      type: "achievement",
      title: "Stayed Under Budget",
      date: "Jun 1, 2026",
      xp_change: 10,
      hp_change: 0,
      severity: "success",
    },
    {
      id: "evt-002",
      type: "penalty",
      title: "Ghost Penalty Applied",
      date: "May 28, 2026",
      xp_change: 0,
      hp_change: -10,
      severity: "danger",
    },
    {
      id: "evt-003",
      type: "milestone",
      title: "Day 270 Milestone Reached",
      date: "May 25, 2026",
      xp_change: 50,
      hp_change: 0,
      severity: "milestone",
    },
    {
      id: "evt-004",
      type: "achievement",
      title: "Zero-Spend Day Claimed",
      date: "May 22, 2026",
      xp_change: 10,
      hp_change: 0,
      severity: "success",
    },
    {
      id: "evt-005",
      type: "task",
      title: "Weekly Review Completed",
      date: "May 20, 2026",
      xp_change: 25,
      hp_change: 0,
      severity: "info",
    },
    {
      id: "evt-006",
      type: "hazard",
      title: "Debt Ambush Triggered",
      date: "May 18, 2026",
      xp_change: 0,
      hp_change: -15,
      severity: "danger",
    },
    {
      id: "evt-007",
      type: "achievement",
      title: "Q2 Review: Excellent",
      date: "May 10, 2026",
      xp_change: 150,
      hp_change: 10,
      severity: "milestone",
    },
    {
      id: "evt-008",
      type: "achievement",
      title: "Stayed Under Budget",
      date: "May 8, 2026",
      xp_change: 10,
      hp_change: 0,
      severity: "success",
    },
    {
      id: "evt-009",
      type: "penalty",
      title: "Daily Bleed Applied",
      date: "May 5, 2026",
      xp_change: 0,
      hp_change: -8,
      severity: "danger",
    },
    {
      id: "evt-010",
      type: "milestone",
      title: "Day 240 Milestone Reached",
      date: "Apr 28, 2026",
      xp_change: 50,
      hp_change: 0,
      severity: "milestone",
    },
  ],
};

// ─── Store Interface ──────────────────────────────────────────────────────────

interface JourneyStore {
  // ── Development data ──────────────────────────────────────────────────────
  /**
   * Set to true in components that use TanStack Query as the data source.
   * When false, components fall back to MOCK_BOOTSTRAP / MOCK_JOURNEY_OVERVIEW.
   */
  useMockData: boolean;

  // ── Cached hydration data ─────────────────────────────────────────────────
  // These are populated when TanStack Query resolves, so components
  // don't need to prop-drill the payload through the tree.
  bootstrap: BootstrapPayload | null;

  // ── Notification state ────────────────────────────────────────────────────
  /** Optimistically track which notification IDs the user has seen */
  readNotificationIds: Set<string>;

  // ── Modal coordination ────────────────────────────────────────────────────
  /**
   * Only one modal can be open at a time.
   * null = no modal open.
   */
  activeModal: ModalPayload;

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Hydrate the store from a resolved bootstrap API response */
  setBootstrap: (data: BootstrapPayload) => void;

  /** Open the Region Detail modal with optimistic summary data */
  openRegionModal: (regionId: string, summary: CurrentRegion) => void;

  /** Open the Review Detail modal with optimistic summary data */
  openReviewModal: (reviewId: string, summary: QuarterlyReview) => void;

  /** Open the Passport Stamp detail modal */
  openStampModal: (stamp: PassportStamp) => void;

  /** Close whichever modal is currently active */
  closeModal: () => void;

  /** Mark a notification as read in optimistic local state */
  markNotificationRead: (id: string) => void;

  /** Mark all notifications as read */
  markAllNotificationsRead: () => void;

  /** Toggle between mock data and live API data */
  setUseMockData: (value: boolean) => void;
}

// ─── Store Creation ───────────────────────────────────────────────────────────

export const useJourneyStore = create<JourneyStore>()(
  devtools(
    (set) => ({
      // ── Initial state ────────────────────────────────────────────────────
      useMockData: process.env.NODE_ENV === "development",
      bootstrap: null,
      readNotificationIds: new Set<string>(),
      activeModal: null,

      // ── Data hydration ────────────────────────────────────────────────────
      setBootstrap: (data) =>
        set({ bootstrap: data }, false, "journey/setBootstrap"),

      // ── Modal actions ──────────────────────────────────────────────────────
      openRegionModal: (regionId, summary) =>
        set(
          { activeModal: { kind: "region", regionId, summary } },
          false,
          "journey/openRegionModal"
        ),

      openReviewModal: (reviewId, summary) =>
        set(
          { activeModal: { kind: "review", reviewId, summary } },
          false,
          "journey/openReviewModal"
        ),

      openStampModal: (stamp) =>
        set(
          { activeModal: { kind: "stamp", stamp } },
          false,
          "journey/openStampModal"
        ),

      closeModal: () =>
        set({ activeModal: null }, false, "journey/closeModal"),

      // ── Notification actions ──────────────────────────────────────────────
      markNotificationRead: (id) =>
        set(
          (state) => ({
            readNotificationIds: new Set([...state.readNotificationIds, id]),
          }),
          false,
          "journey/markNotificationRead"
        ),

      markAllNotificationsRead: () =>
        set(
          (state) => ({
            readNotificationIds: new Set([
              ...state.readNotificationIds,
              ...(state.bootstrap?.notifications.items.map((n) => n.id) ?? []),
            ]),
          }),
          false,
          "journey/markAllNotificationsRead"
        ),

      // ── Dev toggles ───────────────────────────────────────────────────────
      setUseMockData: (value) =>
        set({ useMockData: value }, false, "journey/setUseMockData"),
    }),
    {
      name: "FinJourney:JourneyStore",
      // Omit the Set from serialization since Redux DevTools can't display it
      serialize: {
        replacer: (_key: string, value: unknown) =>
          value instanceof Set ? [...value] : value,
      },
    }
  )
);

// ─── Selector Hooks ───────────────────────────────────────────────────────────
// Granular selectors prevent full re-renders when unrelated state changes.

/** Returns the active modal payload — null when no modal is open */
export const useActiveModal = () =>
  useJourneyStore((s) => s.activeModal);

/** Returns all three modal actions as a stable object */
export const useModalActions = () =>
  useJourneyStore(
    useShallow((s) => ({
      openRegionModal: s.openRegionModal,
      openReviewModal: s.openReviewModal,
      openStampModal: s.openStampModal,
      closeModal: s.closeModal,
    }))
  );

/** Returns the effective bootstrap data — live API or mock */
export const useBootstrapData = (): BootstrapPayload =>
  useJourneyStore((s) =>
    s.useMockData ? MOCK_BOOTSTRAP : (s.bootstrap ?? MOCK_BOOTSTRAP)
  );

/** Returns unread notification count adjusted for optimistic reads */
export const useUnreadCount = (): number =>
  useJourneyStore((s) => {
    const data = s.useMockData
      ? MOCK_BOOTSTRAP
      : (s.bootstrap ?? MOCK_BOOTSTRAP);
    const serverCount = data.notifications.unread_count;
    const optimisticReads = data.notifications.items.filter(
      (n) => !n.read && s.readNotificationIds.has(n.id)
    ).length;
    return Math.max(0, serverCount - optimisticReads);
  });

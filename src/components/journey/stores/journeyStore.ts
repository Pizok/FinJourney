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
  QuarterlyReportListItem,
  PassportStamp,
  LockedStamp,
} from "../types/journey.types";

// ─── Store Interface ──────────────────────────────────────────────────────────

interface JourneyStore {

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

  /** Open the Report Detail modal with report metadata */
  openReportModal: (report: QuarterlyReportListItem) => void;

  /** Open the Passport Stamp detail modal */
  openStampModal: (stamp: PassportStamp) => void;

  /** Open the History modal */
  openHistoryModal: () => void;

  /** Open the All Stamps modal */
  openAllStampsModal: (stamps: PassportStamp[], locked: LockedStamp[]) => void;

  /** Close whichever modal is currently active */
  closeModal: () => void;

  /** Mark a notification as read in optimistic local state */
  markNotificationRead: (id: string) => void;

  /** Mark all notifications as read */
  markAllNotificationsRead: () => void;
}

// ─── Store Creation ───────────────────────────────────────────────────────────

export const useJourneyStore = create<JourneyStore>()(
  devtools(
    (set) => ({
      // ── Initial state ────────────────────────────────────────────────────
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

      openReportModal: (report) =>
        set(
          { activeModal: { kind: "report", report } },
          false,
          "journey/openReportModal"
        ),

      openStampModal: (stamp) =>
        set(
          { activeModal: { kind: "stamp", stamp } },
          false,
          "journey/openStampModal"
        ),

      openHistoryModal: () =>
        set(
          { activeModal: { kind: "history" } },
          false,
          "journey/openHistoryModal"
        ),

      openAllStampsModal: (stamps, locked) =>
        set(
          { activeModal: { kind: "all_stamps", stamps, locked } },
          false,
          "journey/openAllStampsModal"
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
      openReportModal: s.openReportModal,
      openStampModal: s.openStampModal,
      openHistoryModal: s.openHistoryModal,
      openAllStampsModal: s.openAllStampsModal,
      closeModal: s.closeModal,
    }))
  );

/** Returns the effective bootstrap data — live API or mock */
export const useBootstrapData = (): BootstrapPayload | null =>
  useJourneyStore((s) => s.bootstrap);

/** Returns unread notification count adjusted for optimistic reads */
export const useUnreadCount = (): number =>
  useJourneyStore((s) => {
    if (!s.bootstrap) return 0;
    const serverCount = s.bootstrap.notifications.unread_count;
    const optimisticReads = s.bootstrap.notifications.items.filter(
      (n) => !n.read && s.readNotificationIds.has(n.id)
    ).length;
    return Math.max(0, serverCount - optimisticReads);
  });

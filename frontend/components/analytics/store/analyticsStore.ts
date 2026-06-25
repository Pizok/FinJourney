/**
 * analyticsStore.ts
 *
 * Zustand store for Analytics page global state.
 *
 * Manages:
 *  - Time range selection (shared across all charts and metrics)
 *  - Bootstrap data cache (hydrated by TanStack Query in Part 2)
 *  - Per-section loading state for selective refresh after mutations
 *  - Modal open/close state for Rebalance, Loan Simulator, Savings Target
 *
 * Canonical path: components/analytics/stores/analyticsStore.ts
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type {
  TimeRange,
  AnalyticsBootstrap,
  AnalyticsSectionKey,
} from '../types/analytics.types'

// ─── Store Interface ───────────────────────────────────────────────────────────

export interface AnalyticsState {
  // ── Time Range ──────────────────────────────────────────────────────────────
  /**
   * Shared time range selector. Changing it triggers re-fetches in all
   * chart and metric sections without a full page reload.
   * Default: '1M' per PRD specification.
   */
  timeRange: TimeRange
  setTimeRange: (range: TimeRange) => void

  // ── Global Loading ──────────────────────────────────────────────────────────
  /** True only during initial bootstrap fetch. */
  isLoading: boolean
  setLoading: (loading: boolean) => void

  // ── Global Error ────────────────────────────────────────────────────────────
  error: string | null
  setError: (error: string | null) => void

  // ── Section-Level Refresh ───────────────────────────────────────────────────
  /**
   * Tracks which sections are currently refetching after a mutation.
   * Sections not in this set preserve their previous data on screen
   * until fresh data arrives — prevents layout shift during partial updates.
   */
  refreshingSections: Set<AnalyticsSectionKey>
  markSectionRefreshing: (section: AnalyticsSectionKey) => void
  markSectionReady: (section: AnalyticsSectionKey) => void
  markSectionsRefreshing: (sections: AnalyticsSectionKey[]) => void

  // ── Modals ──────────────────────────────────────────────────────────────────
  isRebalanceModalOpen: boolean
  openRebalanceModal: () => void
  closeRebalanceModal: () => void

  isLoanSimulatorOpen: boolean
  openLoanSimulator: () => void
  closeLoanSimulator: () => void

  isSavingsTargetOpen: boolean
  openSavingsTarget: () => void
  closeSavingsTarget: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAnalyticsStore = create<AnalyticsState>()(
  devtools(
    (set) => ({
      // ── Time Range ────────────────────────────────────────────────────────
      timeRange: '1M',
      setTimeRange: (range) =>
        set({ timeRange: range }, false, 'analytics/setTimeRange'),

      // ── Loading ───────────────────────────────────────────────────────────
      isLoading: true,
      setLoading: (loading) =>
        set({ isLoading: loading }, false, 'analytics/setLoading'),

      // ── Error ─────────────────────────────────────────────────────────────
      error: null,
      setError: (error) =>
        set({ error }, false, 'analytics/setError'),

      // ── Section Refresh ───────────────────────────────────────────────────
      refreshingSections: new Set(),

      markSectionRefreshing: (section) =>
        set(
          (state) => ({
            refreshingSections: new Set(state.refreshingSections).add(section),
          }),
          false,
          'analytics/markSectionRefreshing',
        ),

      markSectionReady: (section) =>
        set(
          (state) => {
            const next = new Set(state.refreshingSections)
            next.delete(section)
            return { refreshingSections: next }
          },
          false,
          'analytics/markSectionReady',
        ),

      markSectionsRefreshing: (sections) =>
        set(
          (state) => {
            const next = new Set(state.refreshingSections)
            sections.forEach((s) => next.add(s))
            return { refreshingSections: next }
          },
          false,
          'analytics/markSectionsRefreshing',
        ),

      // ── Rebalance Modal ───────────────────────────────────────────────────
      isRebalanceModalOpen: false,
      openRebalanceModal: () =>
        set({ isRebalanceModalOpen: true }, false, 'analytics/openRebalanceModal'),
      closeRebalanceModal: () =>
        set({ isRebalanceModalOpen: false }, false, 'analytics/closeRebalanceModal'),

      // ── Loan Simulator ────────────────────────────────────────────────────
      isLoanSimulatorOpen: false,
      openLoanSimulator: () =>
        set({ isLoanSimulatorOpen: true }, false, 'analytics/openLoanSimulator'),
      closeLoanSimulator: () =>
        set({ isLoanSimulatorOpen: false }, false, 'analytics/closeLoanSimulator'),

      // ── Savings Target ────────────────────────────────────────────────────
      isSavingsTargetOpen: false,
      openSavingsTarget: () =>
        set({ isSavingsTargetOpen: true }, false, 'analytics/openSavingsTarget'),
      closeSavingsTarget: () =>
        set({ isSavingsTargetOpen: false }, false, 'analytics/closeSavingsTarget'),
    }),
    { name: 'FinJourney:Analytics' },
  ),
)

// ─── Typed Selectors ──────────────────────────────────────────────────────────
// Use these inside components to avoid inline selector logic.

export const selectIsSectionRefreshing =
  (section: AnalyticsSectionKey) =>
  (s: AnalyticsState): boolean =>
    s.refreshingSections.has(section)

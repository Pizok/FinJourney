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

// ─── Development Fixtures ──────────────────────────────────────────────────────
// These are used for local development and UI component testing only.
// TanStack Query (Part 2) replaces these with live API data in production.

/**
 * MOCK_BOOTSTRAP_LOCKED
 * Simulates a Level 2 user who has not yet unlocked Analytics.
 * Use this to develop and test the AnalyticsLockedOverlay and AnalyticsPreview.
 */
export const MOCK_BOOTSTRAP_LOCKED: AnalyticsBootstrap = {
  unlock_status: {
    unlocked: false,
    current_level: 2,
    required_level: 3,
    xp_remaining: 180,
  },
  advisory: null,
  financial_stability: { score: 0, score_trend: 0, explanation: '' },
  cashflow: { trend_percentage: 0, comparison_period: '', series: [] },
  income_allocation: {
    total_income: 0,
    baseline_costs: 0,
    variable_spending: 0,
    remaining_amount: 0,
  },
  category_breakdown: [],
  debt_health: {
    dti_percentage: 0,
    status: 'good',
    active_loans: 0,
    debt_free_date: null,
    safe_loan_limit: 0,
  },
  asset_health: {
    liquid_cash: 0,
    invested_assets: 0,
    survival_runway_months: 0,
    savings_target_progress: 0,
  },
  top_transactions: [],
}

/**
 * MOCK_BOOTSTRAP_UNLOCKED
 * Simulates a Level 4 user with realistic financial data.
 * Use this to develop all unlocked analytics sections.
 *
 * Financial scenario: Salary worker, one active loan, no investments,
 * overspending in Food & Dining and Shopping, otherwise healthy.
 */
export const MOCK_BOOTSTRAP_UNLOCKED: AnalyticsBootstrap = {
  unlock_status: {
    unlocked: true,
    current_level: 4,
    required_level: 3,
    xp_remaining: 0,
  },
  advisory: {
    priority: 'overspending',
    headline: 'Food & Dining is over budget this month',
    recommendation:
      'You have spent 43% above your Food & Dining limit. Reducing Entertainment and Shopping can bring your budget back into balance.',
    reduction_targets: [
      { category_name: 'Entertainment', amount: 150_000 },
      { category_name: 'Shopping', amount: 80_000 },
    ],
  },
  financial_stability: {
    score: 72,
    score_trend: 4,
    explanation:
      'Your cashflow improved this month and debt payments are on track. Tightening variable category spending would push your score meaningfully higher.',
  },
  cashflow: {
    trend_percentage: 12.5,
    comparison_period: 'vs last month',
    series: [
      { date: '2025-04-01', income: 8_500_000, expense: 3_200_000 },
      { date: '2025-04-08', income: 0,         expense: 1_800_000 },
      { date: '2025-04-15', income: 0,         expense: 2_100_000 },
      { date: '2025-04-22', income: 0,         expense: 1_650_000 },
      { date: '2025-04-29', income: 0,         expense: 1_400_000 },
      { date: '2025-05-01', income: 8_500_000, expense: 2_900_000 },
      { date: '2025-05-08', income: 0,         expense: 1_950_000 },
      { date: '2025-05-15', income: 0,         expense: 2_400_000 },
      { date: '2025-05-22', income: 0,         expense: 1_750_000 },
      { date: '2025-05-29', income: 0,         expense: 1_600_000 },
    ],
  },
  income_allocation: {
    total_income: 8_500_000,
    baseline_costs: 3_800_000,
    variable_spending: 2_150_000,
    remaining_amount: 2_550_000,
  },
  category_breakdown: [
    { category_id: 'c1', category_name: 'Food & Dining',  amount: 1_450_000, percentage: 31.2, overspending: true  },
    { category_id: 'c2', category_name: 'Transportation', amount:   620_000, percentage: 13.3, overspending: false },
    { category_id: 'c3', category_name: 'Entertainment',  amount:   480_000, percentage: 10.3, overspending: false },
    { category_id: 'c4', category_name: 'Shopping',       amount:   890_000, percentage: 19.1, overspending: true  },
    { category_id: 'c5', category_name: 'Utilities',      amount:   310_000, percentage:  6.7, overspending: false },
    { category_id: 'c6', category_name: 'Other',          amount:   500_000, percentage: 10.8, overspending: false },
  ],
  debt_health: {
    dti_percentage: 18.5,
    status: 'good',
    active_loans: 1,
    debt_free_date: '2026-11-15',
    safe_loan_limit: 1_250_000,
  },
  asset_health: {
    liquid_cash: 12_500_000,
    invested_assets: 0,
    survival_runway_months: 3.8,
    savings_target_progress: 42,
  },
  top_transactions: [
    { id: 't1', amount: 1_200_000, category_name: 'Rent',         wallet_name: 'Main Wallet', transaction_date: '2025-05-01' },
    { id: 't2', amount:   850_000, category_name: 'Shopping',     wallet_name: 'Main Wallet', transaction_date: '2025-05-12' },
    { id: 't3', amount:   650_000, category_name: 'Food & Dining',wallet_name: 'Main Wallet', transaction_date: '2025-05-18' },
    { id: 't4', amount:   480_000, category_name: 'Loan Payment', wallet_name: 'Main Wallet', transaction_date: '2025-05-05' },
    { id: 't5', amount:   350_000, category_name: 'Entertainment',wallet_name: 'Cash',        transaction_date: '2025-05-22' },
  ],
}

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
      isLoading: false,
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

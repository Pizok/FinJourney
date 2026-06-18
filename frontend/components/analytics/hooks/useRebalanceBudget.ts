/**
 * useRebalanceBudget.ts
 *
 * Manages the full state lifecycle for the Budget Adjustment Planner.
 *
 * State flow (analytics_state_flow.md):
 *   Open Modal → Choose Strategy → Validate Zero-Sum → Submit →
 *   Update Category Limits → Refresh Advisory → Recalculate Daily
 *   Safe Spending → Show Success Toast
 *
 * Zero-sum invariant (enforced by this hook):
 *   sum(all adjustments) === overspentAmount
 *   Where overspentAmount = sum(advisory.reduction_targets[i].amount)
 *
 *   The backend validates this independently. The hook pre-validates
 *   client-side so the user receives immediate feedback without a
 *   round-trip. `isZeroSumValid` gates the submit action.
 *
 * Sections refreshed after success (analytics_state_flow.md):
 *   - advisory (recommendation recalculates)
 *   - income_allocation (daily safe spending recalculates)
 *   - category_breakdown (category limits updated)
 *
 * Data limitations in current scope:
 *   CategoryBreakdown does not include `category_limit`. The hook uses
 *   `category.amount` (actual spending) as a proxy for display purposes.
 *   The payload sends the raw reduction delta; the backend holds the
 *   authoritative limit values.
 *
 * Canonical path: components/analytics/hooks/useRebalanceBudget.ts
 */

import { useState, useCallback, useMemo } from 'react'
import { useAnalyticsStore } from '../stores/analyticsStore'
import type {
  RebalanceStrategy,
  RebalanceAdjustment,
  RebalanceBudgetPayload,
  CategoryBreakdown,
} from '../types/analytics.types'

// ─── API ──────────────────────────────────────────────────────────────────────
// Endpoint implied by state flow. Will be wrapped by TanStack Query mutation
// in the data-fetching layer (Part 5). Used directly here for Part 4.

const REBALANCE_ENDPOINT = '/api/v1/analytics/rebalance-budget'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseRebalanceBudgetReturn {
  // ── Strategy ────────────────────────────────────────────────────────────────
  strategy:    RebalanceStrategy
  setStrategy: (s: RebalanceStrategy) => void

  // ── Context (derived from store) ─────────────────────────────────────────────
  /** Total shortfall to cover. Sum of advisory.reduction_targets amounts. */
  overspentAmount:          number
  /** Categories currently over their limit */
  overspendingCategories:   CategoryBreakdown[]
  /** Categories available to draw adjustments from */
  availableCategories:      CategoryBreakdown[]

  // ── Adjustments: category_id → reduction amount ────────────────────────────
  adjustments:     Record<string, number>
  setAdjustment:   (categoryId: string, amount: number) => void
  clearAdjustments: () => void

  // ── Zero-sum validation ────────────────────────────────────────────────────
  totalAdjusted:  number   // sum of all entered adjustments
  balance:        number   // overspentAmount − totalAdjusted (target: 0)
  isZeroSumValid: boolean  // true when |balance| < 1 and totalAdjusted > 0

  // ── Submission ─────────────────────────────────────────────────────────────
  isSubmitting: boolean
  isSuccess:    boolean
  error:        string | null
  submit:       () => Promise<void>
  reset:        () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRebalanceBudget(): UseRebalanceBudgetReturn {
  const advisory               = useAnalyticsStore((s) => s.bootstrap?.advisory ?? null)
  const categoryBreakdown      = useAnalyticsStore((s) => s.bootstrap?.category_breakdown ?? [])
  const markSectionsRefreshing = useAnalyticsStore((s) => s.markSectionsRefreshing)
  const closeModal             = useAnalyticsStore((s) => s.closeRebalanceModal)

  // ── Strategy ────────────────────────────────────────────────────────────────
  const [strategy, setStrategy] = useState<RebalanceStrategy>('reduce_others')

  // ── Adjustments ─────────────────────────────────────────────────────────────
  const [adjustments, setAdjustmentsMap] = useState<Record<string, number>>({})

  // ── Submission ──────────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess,    setIsSuccess   ] = useState(false)
  const [error,        setError       ] = useState<string | null>(null)

  // ── Derived: context ────────────────────────────────────────────────────────

  const overspentAmount = useMemo(() => {
    if (!advisory?.reduction_targets.length) return 0
    return advisory.reduction_targets.reduce((sum, t) => sum + t.amount, 0)
  }, [advisory])

  const overspendingCategories = useMemo(
    () => categoryBreakdown.filter((c) => c.overspending),
    [categoryBreakdown],
  )

  const availableCategories = useMemo(
    () => categoryBreakdown.filter((c) => !c.overspending),
    [categoryBreakdown],
  )

  // ── Derived: zero-sum validation ────────────────────────────────────────────

  const totalAdjusted = useMemo(
    () => Object.values(adjustments).reduce((sum, v) => sum + (v || 0), 0),
    [adjustments],
  )

  const balance = overspentAmount - totalAdjusted

  // Allow 1-unit tolerance for floating-point IDR amounts
  const isZeroSumValid = Math.abs(balance) < 1 && totalAdjusted > 0

  // ── Actions ─────────────────────────────────────────────────────────────────

  function setAdjustment(categoryId: string, amount: number) {
    setAdjustmentsMap((prev) => ({
      ...prev,
      [categoryId]: Math.max(0, Math.round(amount)),
    }))
  }

  function clearAdjustments() {
    setAdjustmentsMap({})
  }

  const reset = useCallback(() => {
    setStrategy('reduce_others')
    setAdjustmentsMap({})
    setIsSubmitting(false)
    setIsSuccess(false)
    setError(null)
  }, [])

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function submit() {
    setError(null)

    if (!isZeroSumValid) {
      setError('Total reductions must equal the current budget shortfall.')
      return
    }

    setIsSubmitting(true)

    try {
      // Build payload from entered adjustments
      const reductionAdjustments: RebalanceAdjustment[] = Object.entries(adjustments)
        .filter(([, amount]) => amount > 0)
        .map(([categoryId, reductionAmount]) => {
          const cat = categoryBreakdown.find((c) => c.category_id === categoryId)
          return {
            category_id:  categoryId,
            category_name: cat?.category_name ?? '',
            // amount is used as a proxy for the current limit display.
            // The backend holds the authoritative limit value.
            current_limit: cat?.amount ?? 0,
            new_limit:     Math.max(0, (cat?.amount ?? 0) - reductionAmount),
          }
        })

      const payload: RebalanceBudgetPayload = {
        strategy,
        adjustments: reductionAdjustments,
      }

      const response = await fetch(REBALANCE_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error?.message ?? 'Failed to apply adjustments.')
      }

      setIsSuccess(true)

      // Mark sections that need to refetch after rebalance
      // (per analytics_state_flow.md: Refresh Advisory + Allocation + Categories)
      markSectionsRefreshing(['advisory', 'income_allocation', 'category_breakdown'])

      // Close modal after brief success display window
      setTimeout(closeModal, 1_600)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    strategy,
    setStrategy,
    overspentAmount,
    overspendingCategories,
    availableCategories,
    adjustments,
    setAdjustment,
    clearAdjustments,
    totalAdjusted,
    balance,
    isZeroSumValid,
    isSubmitting,
    isSuccess,
    error,
    submit,
    reset,
  }
}

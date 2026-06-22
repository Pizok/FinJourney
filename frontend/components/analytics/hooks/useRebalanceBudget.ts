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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAnalyticsStore } from '../stores/analyticsStore'
import { useAnalyticsData } from '../layout/AnalyticsContext'
import { apiFetchClient } from '@/lib/apiClient.client'
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
  submit:       () => void
  reset:        () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRebalanceBudget(): UseRebalanceBudgetReturn {
  const { advisory = null, category_breakdown: categoryBreakdown = [] } = useAnalyticsData()
  const closeModal             = useAnalyticsStore((s) => s.closeRebalanceModal)
  const queryClient            = useQueryClient()

  // ── Strategy ────────────────────────────────────────────────────────────────
  const [strategy, setStrategy] = useState<RebalanceStrategy>('reduce_others')

  // ── Adjustments ─────────────────────────────────────────────────────────────
  const [adjustments, setAdjustmentsMap] = useState<Record<string, number>>({})

  // ── Submission ──────────────────────────────────────────────────────────────
  const [isSuccess,    setIsSuccess   ] = useState(false)
  const [error,        setError       ] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (payload: RebalanceBudgetPayload) => {
      // The apiFetchClient might throw an error if the response is not ok
      return await apiFetchClient('wallets/rebalance-budget', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      setIsSuccess(true)
      // Invalidate the analytics overview cache to force a refetch
      queryClient.invalidateQueries({ queryKey: ['analytics', 'overview'] })
      setTimeout(closeModal, 1_600)
    },
    onError: (err: any) => {
      setError(err instanceof Error ? err.message : 'Failed to apply adjustments.')
    },
  })

  // ── Derived: context ────────────────────────────────────────────────────────

  const overspentAmount = useMemo(() => {
    if (!advisory?.reduction_targets.length) return 0
    return advisory.reduction_targets.reduce((sum: number, t: any) => sum + t.amount, 0)
  }, [advisory])

  const overspendingCategories = useMemo(
    () => categoryBreakdown.filter((c: CategoryBreakdown) => c.overspending),
    [categoryBreakdown],
  )

  const availableCategories = useMemo(
    () => categoryBreakdown.filter((c: CategoryBreakdown) => !c.overspending),
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
    setIsSuccess(false)
    setError(null)
    mutation.reset()
  }, [mutation])

  // ── Submit ─────────────────────────────────────────────────────────────────

  function submit() {
    setError(null)

    if (!isZeroSumValid) {
      setError('Total reductions must equal the current budget shortfall.')
      return
    }

    // Build payload from entered adjustments
    const reductionAdjustments: RebalanceAdjustment[] = Object.entries(adjustments)
      .filter(([, amount]) => amount > 0)
      .map(([categoryId, reductionAmount]) => {
        const cat = categoryBreakdown.find((c: CategoryBreakdown) => c.category_id === categoryId)
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

    mutation.mutate(payload)
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
    isSubmitting: mutation.isPending,
    isSuccess,
    error,
    submit,
    reset,
  }
}

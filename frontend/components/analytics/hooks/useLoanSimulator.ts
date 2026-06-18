/**
 * useLoanSimulator.ts
 *
 * Manages the full state lifecycle for the Loan Impact Simulator.
 *
 * State flow (analytics_state_flow.md):
 *   Open Simulator → Input Monthly Installment → Calculate Projection
 *   → Display DTI Result
 *
 * Critical constraint — no data mutation:
 *   This hook is purely advisory. It calls the simulate-loan endpoint
 *   which returns projections only. No category limits, loan records,
 *   or financial state are modified. The store is not updated after
 *   a successful simulation.
 *
 * API contract (analytics_data_contract.md):
 *   POST /api/v1/analytics/simulate-loan
 *   Request:  { monthly_installment: number }
 *   Response: { projected_dti: number, projected_status: HealthStatus }
 *
 * Impact message:
 *   Derived on the frontend from the status transition and DTI delta.
 *   Pure display logic — not a financial calculation.
 *
 * Canonical path: components/analytics/hooks/useLoanSimulator.ts
 */

import { useState, useMemo, useCallback } from 'react'
import { useAnalyticsStore } from '../stores/analyticsStore'
import type { LoanSimulationResult, HealthStatus } from '../types/analytics.types'

// ─── API ──────────────────────────────────────────────────────────────────────

const SIMULATE_ENDPOINT = '/api/v1/analytics/simulate-loan'

// ─── Impact Message Generator ─────────────────────────────────────────────────
// Pure function — no side effects, safe to call during render.

// Using a Map instead of a plain Record so that STATUS_LABELS[status] bracket
// access on server-supplied HealthStatus values is replaced with Map.get().
const STATUS_LABELS = new Map<HealthStatus, string>([
  ['good',    'Good'],
  ['warning', 'Warning'],
  ['bad',     'High Risk'],
])

function generateImpactMessage(
  currentDti:      number,
  projectedDti:    number,
  currentStatus:   HealthStatus,
  projectedStatus: HealthStatus,
): string {
  const delta         = projectedDti - currentDti
  const statusChanged = currentStatus !== projectedStatus

  if (delta <= 0) {
    return `This installment would keep your DTI stable at ${projectedDti.toFixed(1)}%, remaining within the ${STATUS_LABELS.get(projectedStatus)} range.`
  }

  if (statusChanged) {
    return `Adding this installment would increase your DTI by ${delta.toFixed(1)} percentage points, shifting your status from ${STATUS_LABELS.get(currentStatus)} to ${STATUS_LABELS.get(projectedStatus)}. Consider the impact on your financial flexibility before committing.`
  }

  return `Adding this installment would raise your DTI by ${delta.toFixed(1)} percentage points to ${projectedDti.toFixed(1)}%, remaining within the ${STATUS_LABELS.get(projectedStatus)} range.`
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseLoanSimulatorReturn {
  // ── Input ─────────────────────────────────────────────────────────────────
  /** Raw string value of the controlled input field */
  monthlyInstallment:    string
  setMonthlyInstallment: (v: string) => void
  /** Parsed numeric value; NaN when input is empty or non-numeric */
  parsedInstallment:     number

  // ── Current debt context (read-only from bootstrap) ────────────────────────
  currentDti:    number | null
  currentStatus: HealthStatus | null

  // ── Simulation result ──────────────────────────────────────────────────────
  result:        LoanSimulationResult | null
  impactMessage: string | null

  // ── Async state ────────────────────────────────────────────────────────────
  isLoading: boolean
  error:     string | null

  // ── Actions ───────────────────────────────────────────────────────────────
  simulate: () => Promise<void>
  reset:    () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLoanSimulator(): UseLoanSimulatorReturn {
  const debtHealth = useAnalyticsStore((s) => s.bootstrap?.debt_health ?? null)

  // Input state — string to handle empty field gracefully
  const [monthlyInstallment, setMonthlyInstallment] = useState('')

  // Result state
  const [result,    setResult   ] = useState<LoanSimulationResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError    ] = useState<string | null>(null)

  // Derived values
  const parsedInstallment = useMemo(
    () => parseFloat(monthlyInstallment.replace(/[^0-9.]/g, '')) || 0,
    [monthlyInstallment],
  )

  const currentDti    = debtHealth?.dti_percentage ?? null
  const currentStatus = debtHealth?.status ?? null

  // Impact message — only when we have a result and current context
  const impactMessage = useMemo(() => {
    if (!result || currentDti === null || currentStatus === null) return null
    return generateImpactMessage(
      currentDti,
      result.projected_dti,
      currentStatus,
      result.projected_status,
    )
  }, [result, currentDti, currentStatus])

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function simulate() {
    if (parsedInstallment <= 0) {
      setError('Please enter a valid monthly installment amount.')
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(SIMULATE_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ monthly_installment: parsedInstallment }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error?.message ?? 'Simulation failed. Please try again.')
      }

      const data: LoanSimulationResult = await response.json()
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.')
    } finally {
      setIsLoading(false)
    }
  }

  const reset = useCallback(() => {
    setMonthlyInstallment('')
    setResult(null)
    setIsLoading(false)
    setError(null)
  }, [])

  return {
    monthlyInstallment,
    setMonthlyInstallment,
    parsedInstallment,
    currentDti,
    currentStatus,
    result,
    impactMessage,
    isLoading,
    error,
    simulate,
    reset,
  }
}

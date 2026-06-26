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
import { useMutation } from '@tanstack/react-query'
import { apiFetchClient } from '@/lib/apiClient.client'
import type { LoanSimulationResult, LoanSimulationRequest } from '../types/analytics.types'

// ─── API ──────────────────────────────────────────────────────────────────────

const SIMULATE_ENDPOINT = '/api/v1/analytics/simulate-loan'

// ─── Formatting ───────────────────────────────────────────────────────────────

const formatDate = (dateString: string) => {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(dateString))
}

// ─── Impact Message Generator ─────────────────────────────────────────────────
// Pure function — no side effects, safe to call during render.

function generateImpactMessage(result: LoanSimulationResult): string {
  if (!result.is_payable || !result.projected_months || !result.debt_free_date) {
    return 'The specified monthly payment is too low to cover the interest. The loan principal will never decrease, making it unpayable.'
  }

  const durationText = result.projected_months === 1 ? '1 month' : `${result.projected_months} months`
  const dateText = formatDate(result.debt_free_date)

  if (result.total_interest_paid && result.total_interest_paid > 0) {
    return `At this rate, you will be debt-free by ${dateText} (in ${durationText}). You will pay an estimated total interest of ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(result.total_interest_paid)}.`
  }

  return `At this rate, you will be debt-free by ${dateText} (in ${durationText}).`
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseLoanSimulatorReturn {
  // ── Input ─────────────────────────────────────────────────────────────────
  /** Raw string value of the monthly payment field */
  monthlyPayment:        string
  setMonthlyPayment:     (v: string) => void
  /** Parsed numeric value of monthly payment */
  parsedPayment:         number

  /** Raw string value of the remaining debt field */
  remainingDebt:         string
  setRemainingDebt:      (v: string) => void
  /** Parsed numeric value of remaining debt */
  parsedDebt:            number

  /** Raw string value of the annual interest rate field */
  interestRate:          string
  setInterestRate:       (v: string) => void
  /** Parsed numeric value of interest rate */
  parsedInterest:        number

  // ── Simulation result ──────────────────────────────────────────────────────
  result:        LoanSimulationResult | null
  impactMessage: string | null

  // ── Async state ────────────────────────────────────────────────────────────
  isLoading: boolean
  error:     string | null

  // ── Actions ───────────────────────────────────────────────────────────────
  simulate: () => void
  reset:    () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLoanSimulator(): UseLoanSimulatorReturn {
  // Input state
  const [remainingDebt, setRemainingDebt] = useState('')
  const [monthlyPayment, setMonthlyPayment] = useState('')
  const [interestRate, setInterestRate] = useState('')

  // Result state
  const [result,    setResult   ] = useState<LoanSimulationResult | null>(null)
  const [error,     setError    ] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (payload: LoanSimulationRequest) => {
      return await apiFetchClient<LoanSimulationResult>('analytics/simulate-loan', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    onSuccess: (data: LoanSimulationResult) => {
      setResult(data)
    },
    onError: (err: any) => {
      setError(err instanceof Error ? err.message : 'Simulation failed. Please try again.')
    },
  })

  // Derived values
  const parsedDebt = useMemo(
    () => parseFloat(remainingDebt.replace(/[^0-9.]/g, '')) || 0,
    [remainingDebt],
  )
  
  const parsedPayment = useMemo(
    () => parseFloat(monthlyPayment.replace(/[^0-9.]/g, '')) || 0,
    [monthlyPayment],
  )

  const parsedInterest = useMemo(
    () => parseFloat(interestRate.replace(/[^0-9.]/g, '')) || 0,
    [interestRate],
  )

  // Impact message — only when we have a result
  const impactMessage = useMemo(() => {
    if (!result) return null
    return generateImpactMessage(result)
  }, [result])

  // ── Actions ─────────────────────────────────────────────────────────────────

  function simulate() {
    if (parsedDebt <= 0) {
      setError('Please enter a valid loan principal amount.')
      return
    }
    if (parsedPayment <= 0) {
      setError('Please enter a valid monthly payment amount.')
      return
    }

    setError(null)
    setResult(null)

    mutation.mutate({ 
      remaining_debt: parsedDebt,
      monthly_payment: parsedPayment,
      annual_interest_rate: parsedInterest > 0 ? parsedInterest / 100 : 0
    })
  }

  const reset = useCallback(() => {
    setRemainingDebt('')
    setMonthlyPayment('')
    setInterestRate('')
    setResult(null)
    setError(null)
    mutation.reset()
  }, [mutation])

  return {
    monthlyPayment,
    setMonthlyPayment,
    parsedPayment,
    remainingDebt,
    setRemainingDebt,
    parsedDebt,
    interestRate,
    setInterestRate,
    parsedInterest,
    result,
    impactMessage,
    isLoading: mutation.isPending,
    error,
    simulate,
    reset,
  }
}

'use client'

/**
 * LoanSimulatorModal.tsx
 *
 * Triggered by: "Open Loan Simulator" button in DebtHealthCard.
 * Store key: isLoanSimulatorOpen / closeLoanSimulator
 *
 * State flow (analytics_state_flow.md):
 *   Open → Input Monthly Installment → Calculate Projection → Display DTI Result
 *
 * No data mutation:
 *   This modal is purely advisory. Running a simulation does NOT create
 *   a loan, update limits, or modify any financial state. This is
 *   communicated explicitly in the UI.
 *
 * Layout:
 *   ┌─ Loan Impact Simulator ─────────────────────────────────────────┐
 *   │  Estimate how a new loan payment may affect your health.        │
 *   │                                                                 │
 *   │  Monthly Installment                                            │
 *   │  Rp [ _________________________ ]  [Simulate →]                │
 *   │                                                                 │
 *   │  ── Result appears after simulation ──────────────────────────  │
 *   │  Projected Debt-to-Income Status                                │
 *   │  18.5%  →  24.4%    Good  →  Warning                          │
 *   │                                                                 │
 *   │  Estimated Financial Impact                                     │
 *   │  "Adding this installment would increase your DTI by..."        │
 *   │                                                                 │
 *   │                                             [Close]             │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * Design rules:
 *   - Result panel only renders after a successful simulation
 *   - Status badges use health-status semantics (emerald/gold/terracotta)
 *   - Arrow transition (→) between current and projected values
 *   - "Simulated only" notice prevents user confusion about data mutation
 *
 * Canonical path: components/analytics/modals/LoanSimulatorModal.tsx
 */

import { useEffect, useRef } from 'react'
import { X, Calendar, AlertCircle, FlaskConical, AlertTriangle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnalyticsStore } from '../stores/analyticsStore'
import { useLoanSimulator } from '../hooks/useLoanSimulator'
import type { LoanSimulationResult } from '../types/analytics.types'

// ─── Formatting ───────────────────────────────────────────────────────────────

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)

// ─── Status Config ────────────────────────────────────────────────────────────

// Removed STATUS_CONFIG as it's no longer used for HealthStatus.

// ─── Formatting ───────────────────────────────────────────────────────────────

const formatMonthDuration = (months: number): string => {
  if (months === 1) return '1 month'
  if (months < 12) return `${months} months`
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  if (remainingMonths === 0) return years === 1 ? '1 year' : `${years} years`
  return `${years}y ${remainingMonths}m`
}

const formatDate = (dateString: string) => {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(dateString))
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────

function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const first = contentRef.current?.querySelector<HTMLElement>(
      'button, input, [tabindex]:not([tabindex="-1"])',
    )
    first?.focus()
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-abyssal-slate/80" onClick={onClose} aria-hidden="true" />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="animate-fade-in relative z-10 w-full max-w-lg rounded-xl border border-tactical-border bg-canvas-surface"
      >
        {children}
      </div>
    </div>
  )
}

interface ResultPanelProps {
  result: LoanSimulationResult
  impactMessage: string
}

function ResultPanel({
  result,
  impactMessage,
}: ResultPanelProps) {
  if (!result.is_payable) {
    return (
      <div className="space-y-4">
        {/* Unpayable Status */}
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/10 p-4">
          <div className="mb-3 flex items-center gap-2 text-terracotta">
            <AlertTriangle className="h-5 w-5" strokeWidth={2} />
            <h3 className="font-display text-base font-semibold">Unpayable Loan</h3>
          </div>
          <p className="font-sans text-sm leading-relaxed text-terracotta/90">
            {impactMessage}
          </p>
        </div>
        {/* No-mutation notice */}
        <p className="font-sans text-xs text-muted-text/60">
          This is a simulation only. No loan has been created and no financial
          data has been modified.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Projected Payoff Timeline */}
      <div className="rounded-lg border border-tactical-border bg-abyssal-slate/50 p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="mb-1 font-sans text-xs uppercase tracking-wide text-muted-text">
              Projected Payoff Timeline
            </p>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-semibold text-pearl-text">
                {formatMonthDuration(result.projected_months || 0)}
              </span>
              <span className="font-sans text-sm text-muted-text">
                ({formatDate(result.debt_free_date || '')})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-muted-emerald/10 px-2.5 py-1 text-muted-emerald">
            <CheckCircle className="h-4 w-4" strokeWidth={2} />
            <span className="font-sans text-xs font-medium">Payable</span>
          </div>
        </div>
      </div>

      {/* Estimated Financial Impact */}
      <div className="rounded-lg border border-tactical-border bg-abyssal-slate/50 p-4">
        <p className="mb-2 font-sans text-xs uppercase tracking-wide text-muted-text">
          Estimated Financial Impact
        </p>
        <p className="font-sans text-sm leading-relaxed text-muted-text">
          {impactMessage}
        </p>
      </div>

      {/* No-mutation notice */}
      <p className="font-sans text-xs text-muted-text/60">
        This is a simulation only. No loan has been created and no financial
        data has been modified.
      </p>
    </div>
  )
}

// ─── Modal Body ───────────────────────────────────────────────────────────────

function ModalBody({ onClose }: { onClose: () => void }) {
  const {
    monthlyPayment, setMonthlyPayment, parsedPayment,
    remainingDebt, setRemainingDebt, parsedDebt,
    interestRate, setInterestRate, parsedInterest,
    result, impactMessage,
    isLoading, error,
    simulate, reset,
  } = useLoanSimulator()

  function handleClose() {
    reset()
    onClose()
  }

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 border-b border-tactical-border p-6">
        <div className="space-y-0.5">
          <h2 id="modal-title" className="font-display text-lg font-semibold text-pearl-text">
            Loan Impact Simulator
          </h2>
          <p className="font-sans text-sm text-muted-text">
            Estimate how a new loan payment may affect your financial health.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close modal"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-tactical-border text-muted-text transition-colors hover:text-pearl-text"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="space-y-5 p-6">

        {/* Inputs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Principal */}
          <div className="sm:col-span-2">
            <label htmlFor="remaining-debt" className="mb-1.5 block font-sans text-sm font-medium text-muted-text">
              Loan Principal <span className="text-terracotta">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-sans text-sm text-muted-text">
                Rp
              </span>
              <input
                id="remaining-debt"
                type="number"
                min={0}
                step={100_000}
                value={remainingDebt}
                onChange={(e) => setRemainingDebt(e.target.value)}
                placeholder="10,000,000"
                className={cn(
                  'w-full rounded-lg border border-tactical-border bg-abyssal-slate py-2.5 pl-9 pr-4',
                  'font-sans text-sm text-pearl-text placeholder:text-muted-text/40',
                  'focus:border-muted-emerald/50 focus:outline-none transition-colors duration-150',
                )}
              />
            </div>
          </div>

          {/* Monthly Payment */}
          <div>
            <label htmlFor="monthly-payment" className="mb-1.5 block font-sans text-sm font-medium text-muted-text">
              Monthly Payment <span className="text-terracotta">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-sans text-sm text-muted-text">
                Rp
              </span>
              <input
                id="monthly-payment"
                type="number"
                min={0}
                step={50_000}
                value={monthlyPayment}
                onChange={(e) => setMonthlyPayment(e.target.value)}
                placeholder="500,000"
                className={cn(
                  'w-full rounded-lg border border-tactical-border bg-abyssal-slate py-2.5 pl-9 pr-4',
                  'font-sans text-sm text-pearl-text placeholder:text-muted-text/40',
                  'focus:border-muted-emerald/50 focus:outline-none transition-colors duration-150',
                )}
              />
            </div>
          </div>

          {/* Interest Rate */}
          <div>
            <label htmlFor="interest-rate" className="mb-1.5 block font-sans text-sm font-medium text-muted-text">
              Interest Rate (Annual)
            </label>
            <div className="relative">
              <input
                id="interest-rate"
                type="number"
                min={0}
                step={0.1}
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="10.5"
                className={cn(
                  'w-full rounded-lg border border-tactical-border bg-abyssal-slate py-2.5 pl-4 pr-8',
                  'font-sans text-sm text-pearl-text placeholder:text-muted-text/40',
                  'focus:border-muted-emerald/50 focus:outline-none transition-colors duration-150',
                )}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-sans text-sm text-muted-text">
                %
              </span>
            </div>
          </div>
        </div>

        {/* Simulate Button Container */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-text/60">
            {parsedDebt > 0 && parsedPayment > 0 && (
              <span>Ready to project payoff timeline.</span>
            )}
          </div>
          <button
            type="button"
            onClick={simulate}
            disabled={isLoading || parsedDebt <= 0 || parsedPayment <= 0}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg bg-muted-emerald px-4 py-2.5',
              'font-display text-sm font-semibold text-pearl-text',
              'transition-colors duration-150 hover:bg-muted-emerald/90',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            <FlaskConical className="h-4 w-4" strokeWidth={2} />
            {isLoading ? 'Running…' : 'Simulate'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-terracotta/20 bg-terracotta/8 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
            <p className="font-sans text-sm text-terracotta">{error}</p>
          </div>
        )}

        {/* Pre-simulation placeholder */}
        {!result && !error && (
          <div className="flex items-center justify-center rounded-lg border border-tactical-border/50 bg-abyssal-slate/30 py-8">
            <p className="font-sans text-sm text-muted-text/60">
              Enter the loan details and run a simulation to see results.
            </p>
          </div>
        )}

        {/* Result panel — rendered only after successful simulation */}
        {result && impactMessage && (
          <ResultPanel
            result={result}
            impactMessage={impactMessage}
          />
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="flex justify-end border-t border-tactical-border p-6">
        <button
          type="button"
          onClick={handleClose}
          className={cn(
            'rounded-lg border border-tactical-border px-5 py-2.5',
            'font-display text-sm font-medium text-muted-text',
            'transition-colors duration-150 hover:text-pearl-text',
          )}
        >
          Close
        </button>
      </div>
    </>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LoanSimulatorModal() {
  const isOpen  = useAnalyticsStore((s) => s.isLoanSimulatorOpen)
  const onClose = useAnalyticsStore((s) => s.closeLoanSimulator)

  if (!isOpen) return null

  return (
    <ModalShell onClose={onClose}>
      <ModalBody onClose={onClose} />
    </ModalShell>
  )
}

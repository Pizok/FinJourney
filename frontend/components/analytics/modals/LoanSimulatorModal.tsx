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
import { X, TrendingUp, TrendingDown, Minus, AlertCircle, FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnalyticsStore } from '../stores/analyticsStore'
import { useLoanSimulator } from '../hooks/useLoanSimulator'
import type { HealthStatus } from '../types/analytics.types'

// ─── Formatting ───────────────────────────────────────────────────────────────

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)

// ─── Status Config ────────────────────────────────────────────────────────────

// Using a Map instead of a plain Record so that STATUS_CONFIG[status] bracket
// access on server-supplied HealthStatus values is replaced with Map.get().
const STATUS_CONFIG = new Map<HealthStatus, { label: string; badgeClass: string }>([
  ['good',    { label: 'Good',      badgeClass: 'bg-muted-emerald/10 text-muted-emerald border-muted-emerald/20'  }],
  ['warning', { label: 'Warning',   badgeClass: 'bg-dawn-gold/10 text-dawn-gold border-dawn-gold/20'             }],
  ['bad',     { label: 'High Risk', badgeClass: 'bg-terracotta/10 text-terracotta border-terracotta/20'           }],
])

function StatusBadge({ status }: { status: HealthStatus }) {
  // Map.get() — no bracket notation on server-supplied status value (CWE-94 safe).
  const cfg = STATUS_CONFIG.get(status)!
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5',
        'font-sans text-xs font-medium',
        cfg.badgeClass,
      )}
    >
      {cfg.label}
    </span>
  )
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
        className="animate-fade-in relative z-10 w-full max-w-md rounded-xl border border-tactical-border bg-canvas-surface"
      >
        {children}
      </div>
    </div>
  )
}

// ─── Result Panel ─────────────────────────────────────────────────────────────

interface ResultPanelProps {
  currentDti:    number
  currentStatus: HealthStatus
  projectedDti:  number
  projectedStatus: HealthStatus
  impactMessage: string
}

function ResultPanel({
  currentDti,
  currentStatus,
  projectedDti,
  projectedStatus,
  impactMessage,
}: ResultPanelProps) {
  const delta      = projectedDti - currentDti
  const DeltaIcon  = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
  const deltaClass = delta > 0 ? 'text-terracotta' : delta < 0 ? 'text-muted-emerald' : 'text-muted-text'

  return (
    <div className="space-y-4">
      {/* Projected DTI Status */}
      <div className="rounded-lg border border-tactical-border bg-abyssal-slate/50 p-4">
        <p className="mb-3 font-sans text-xs uppercase tracking-wide text-muted-text">
          Projected Debt-to-Income Status
        </p>

        {/* DTI numbers — current → projected */}
        <div className="mb-3 flex items-center gap-3">
          <span className="font-display text-2xl font-semibold text-pearl-text">
            {currentDti.toFixed(1)}%
          </span>
          <DeltaIcon className={cn('h-4 w-4 shrink-0', deltaClass)} strokeWidth={2} />
          <span className={cn('font-display text-2xl font-semibold', deltaClass)}>
            {projectedDti.toFixed(1)}%
          </span>
        </div>

        {/* Status badges — current → projected */}
        <div className="flex items-center gap-2">
          <StatusBadge status={currentStatus} />
          <span className="font-sans text-xs text-muted-text">→</span>
          <StatusBadge status={projectedStatus} />
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
    monthlyInstallment, setMonthlyInstallment,
    parsedInstallment,
    currentDti, currentStatus,
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

        {/* Input + simulate button */}
        <div>
          <label
            htmlFor="monthly-installment"
            className="mb-1.5 block font-sans text-sm font-medium text-muted-text"
          >
            Monthly Installment
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-sans text-sm text-muted-text">
                Rp
              </span>
              <input
                id="monthly-installment"
                type="number"
                min={0}
                step={50_000}
                value={monthlyInstallment}
                onChange={(e) => setMonthlyInstallment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && simulate()}
                placeholder="500,000"
                className={cn(
                  'w-full rounded-lg border border-tactical-border bg-abyssal-slate py-2.5 pl-9 pr-4',
                  'font-sans text-sm text-pearl-text placeholder:text-muted-text/40',
                  'focus:border-muted-emerald/50 focus:outline-none transition-colors duration-150',
                  error && !result && 'border-terracotta/50',
                )}
              />
            </div>
            <button
              type="button"
              onClick={simulate}
              disabled={isLoading || parsedInstallment <= 0}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5',
                'border border-tactical-border font-display text-sm font-medium text-muted-text',
                'transition-colors duration-150 hover:border-steel-violet/40 hover:text-pearl-text',
                'disabled:cursor-not-allowed disabled:opacity-40',
              )}
            >
              <FlaskConical className="h-4 w-4" strokeWidth={2} />
              {isLoading ? 'Running…' : 'Simulate'}
            </button>
          </div>

          {/* Formatted value preview */}
          {parsedInstallment > 0 && (
            <p className="mt-1.5 font-sans text-xs text-muted-text">
              {formatCurrency(parsedInstallment)} per month
            </p>
          )}
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
              Enter an installment amount and run a simulation to see results.
            </p>
          </div>
        )}

        {/* Result panel — rendered only after successful simulation */}
        {result && currentDti !== null && currentStatus !== null && impactMessage && (
          <ResultPanel
            currentDti={currentDti}
            currentStatus={currentStatus}
            projectedDti={result.projected_dti}
            projectedStatus={result.projected_status}
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

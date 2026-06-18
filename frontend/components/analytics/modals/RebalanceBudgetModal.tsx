'use client'

/**
 * RebalanceBudgetModal.tsx
 *
 * Triggered by: "Rebalance Budget" button in AdvisoryCard.
 * Store key: isRebalanceModalOpen / closeRebalanceModal
 *
 * State flow (analytics_state_flow.md):
 *   Open → Choose Strategy → Adjust Categories → Validate Zero-Sum
 *   → Submit → Show Success → Auto-close (1.6s)
 *
 * Layout:
 *   ┌─ Budget Adjustment Planner ─────────────────────────────────┐
 *   │ [Strategy selector: Reduce Others | Increase Limit]        │
 *   │ ─────────────────────────────────────────────────────────  │
 *   │ Overspending context (which category is over)              │
 *   │ ─────────────────────────────────────────────────────────  │
 *   │ [Adjustment row × N — one per non-overspent category]      │
 *   │ ─────────────────────────────────────────────────────────  │
 *   │ Zero-sum balance summary (real-time)                       │
 *   │ [Cancel]                [Apply Adjustments →]              │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Zero-sum rule (enforced via useRebalanceBudget):
 *   sum(adjustments) === overspentAmount. The Apply button is
 *   disabled until isZeroSumValid is true.
 *
 * Design rules:
 *   - bg-canvas-surface modal, bg-abyssal-slate/80 backdrop (no blur)
 *   - Solid bg-muted-emerald primary CTA (no glow per DESIGN.md)
 *   - Error state in Terracotta; success state in Muted Emerald
 *   - No nested cards: adjustment rows use flat restrained borders
 *
 * Canonical path: components/analytics/modals/RebalanceBudgetModal.tsx
 */

import { useEffect, useRef, useCallback } from 'react'
import { X, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnalyticsStore } from '../stores/analyticsStore'
import { useRebalanceBudget } from '../hooks/useRebalanceBudget'
import type { CategoryBreakdown, RebalanceStrategy } from '../types/analytics.types'

// ─── Formatting ───────────────────────────────────────────────────────────────

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)

// ─── Modal Shell ──────────────────────────────────────────────────────────────
// Self-contained overlay wrapper. Extract to modals/ModalShell.tsx when
// a shared component is justified by the project's modal inventory.

interface ModalShellProps {
  onClose:   () => void
  maxWidth?: string
  children:  React.ReactNode
}

function ModalShell({ onClose, maxWidth = 'max-w-lg', children }: ModalShellProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Focus first focusable element on mount
  useEffect(() => {
    const first = contentRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    first?.focus()
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Backdrop — Abyssal Slate tint, no blur (DESIGN.md: no glassmorphism) */}
      <div
        className="absolute inset-0 bg-abyssal-slate/80"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Content */}
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          'animate-fade-in relative z-10 w-full rounded-xl',
          'border border-tactical-border bg-canvas-surface',
          'max-h-[90vh] overflow-y-auto',
          maxWidth,
        )}
      >
        {children}
      </div>
    </div>
  )
}

// ─── Strategy Selector ────────────────────────────────────────────────────────

const STRATEGIES: { value: RebalanceStrategy; label: string; description: string }[] = [
  {
    value:       'reduce_others',
    label:       'Reduce Other Budgets',
    description: 'Cut limits in other categories to cover the shortfall.',
  },
  {
    value:       'increase_overspent',
    label:       'Increase Budget Limit',
    description: 'Raise the limit for the overspent category.',
  },
]

interface StrategySelectorProps {
  value:    RebalanceStrategy
  onChange: (s: RebalanceStrategy) => void
}

function StrategySelector({ value, onChange }: StrategySelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {STRATEGIES.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors duration-150',
              active
                ? 'border-muted-emerald/40 bg-muted-emerald/8 text-pearl-text'
                : 'border-tactical-border text-muted-text hover:border-tactical-border/70 hover:text-pearl-text',
            )}
            aria-pressed={active}
          >
            <p className="font-display text-sm font-medium">{opt.label}</p>
            <p className="mt-0.5 font-sans text-xs leading-relaxed opacity-70">
              {opt.description}
            </p>
          </button>
        )
      })}
    </div>
  )
}

// ─── Adjustment Row ───────────────────────────────────────────────────────────

interface AdjustmentRowProps {
  category:      CategoryBreakdown
  currentValue:  number
  onAdjust:      (id: string, amount: number) => void
}

function AdjustmentRow({ category, currentValue, onAdjust }: AdjustmentRowProps) {
  const projectedLimit = Math.max(0, category.amount - currentValue)

  return (
    <div className="rounded-lg border border-tactical-border bg-abyssal-slate/40 p-4">
      {/* Category header */}
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="font-display text-sm font-semibold text-pearl-text">
          {category.category_name}
        </span>
        <span className="shrink-0 font-sans text-xs text-muted-text">
          Spent: {formatCurrency(category.amount)}
        </span>
      </div>

      {/* Input */}
      <div>
        <label
          htmlFor={`adj-${category.category_id}`}
          className="mb-1.5 block font-sans text-xs font-medium text-muted-text"
        >
          Reduce monthly limit by
        </label>
        <div className="flex items-center gap-2">
          <span className="shrink-0 font-sans text-sm text-muted-text">Rp</span>
          <input
            id={`adj-${category.category_id}`}
            type="number"
            min={0}
            step={1000}
            value={currentValue || ''}
            onChange={(e) =>
              onAdjust(category.category_id, parseFloat(e.target.value) || 0)
            }
            placeholder="0"
            className={cn(
              'flex-1 rounded-lg border border-tactical-border bg-abyssal-slate px-3 py-2',
              'font-sans text-sm text-pearl-text placeholder:text-muted-text/40',
              'focus:border-muted-emerald/50 focus:outline-none transition-colors duration-150',
            )}
          />
        </div>

        {/* Live preview of new limit */}
        {currentValue > 0 && (
          <p className="mt-1.5 font-sans text-xs text-muted-text">
            New limit:{' '}
            <span className="text-pearl-text">{formatCurrency(projectedLimit)}</span>
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Zero-Sum Balance ─────────────────────────────────────────────────────────

interface ZeroSumSummaryProps {
  overspentAmount: number
  totalAdjusted:   number
  balance:         number
  isZeroSumValid:  boolean
}

function ZeroSumSummary({
  overspentAmount,
  totalAdjusted,
  balance,
  isZeroSumValid,
}: ZeroSumSummaryProps) {
  const remaining = Math.abs(balance)

  const balanceClass = isZeroSumValid
    ? 'text-muted-emerald'
    : balance > 0
      ? 'text-dawn-gold'
      : 'text-terracotta'

  return (
    <div className="rounded-lg border border-tactical-border bg-abyssal-slate/50 p-4">
      <div className="space-y-2">
        {/* Shortfall */}
        <div className="flex items-center justify-between gap-4">
          <span className="font-sans text-sm text-muted-text">Budget shortfall</span>
          <span className="font-display text-sm font-semibold text-pearl-text">
            {formatCurrency(overspentAmount)}
          </span>
        </div>
        {/* Total adjusted */}
        <div className="flex items-center justify-between gap-4">
          <span className="font-sans text-sm text-muted-text">Total adjusted</span>
          <span className="font-display text-sm font-semibold text-pearl-text">
            {formatCurrency(totalAdjusted)}
          </span>
        </div>
        {/* Remaining divider line */}
        <div className="border-t border-tactical-border/60 pt-2">
          <div className="flex items-center justify-between gap-4">
            <span className="font-sans text-sm text-muted-text">Remaining to allocate</span>
            <div className="flex items-center gap-2">
              {isZeroSumValid && (
                <CheckCircle className="h-3.5 w-3.5 text-muted-emerald" strokeWidth={2} />
              )}
              <span className={cn('font-display text-sm font-semibold', balanceClass)}>
                {isZeroSumValid ? 'Balanced' : formatCurrency(remaining)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Success State ────────────────────────────────────────────────────────────

function SuccessState() {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted-emerald/15">
        <CheckCircle className="h-6 w-6 text-muted-emerald" strokeWidth={2} />
      </div>
      <div className="space-y-1">
        <p className="font-display text-base font-semibold text-pearl-text">
          Adjustments Applied
        </p>
        <p className="font-sans text-sm leading-relaxed text-muted-text">
          Your budget has been updated. Affected sections will reflect the
          changes momentarily.
        </p>
      </div>
    </div>
  )
}

// ─── Modal Body ───────────────────────────────────────────────────────────────

function ModalBody({ onClose }: { onClose: () => void }) {
  const {
    strategy, setStrategy,
    overspentAmount, overspendingCategories, availableCategories,
    adjustments, setAdjustment,
    totalAdjusted, balance, isZeroSumValid,
    isSubmitting, isSuccess, error,
    submit, reset,
  } = useRebalanceBudget()

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  if (isSuccess) return <SuccessState />

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 border-b border-tactical-border p-6">
        <div className="space-y-0.5">
          <h2
            id="modal-title"
            className="font-display text-lg font-semibold text-pearl-text"
          >
            Budget Adjustment Planner
          </h2>
          <p className="font-sans text-sm text-muted-text">
            Redistribute spending across categories to bring your budget back
            into balance.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close modal"
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-tactical-border text-muted-text transition-colors hover:text-pearl-text"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <div className="space-y-5 p-6">

        {/* Strategy selector */}
        <StrategySelector value={strategy} onChange={setStrategy} />

        {/* Overspending context */}
        {overspendingCategories.length > 0 && (
          <div className="rounded-lg border border-terracotta/20 bg-terracotta/8 p-4">
            <p className="font-sans text-xs uppercase tracking-wide text-terracotta">
              Overspending detected
            </p>
            <div className="mt-2 space-y-1">
              {overspendingCategories.map((cat) => (
                <div key={cat.category_id} className="flex items-center justify-between gap-4">
                  <span className="font-sans text-sm text-pearl-text">{cat.category_name}</span>
                  <span className="font-display text-sm font-semibold text-terracotta">
                    {formatCurrency(cat.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Zero-sum rule callout */}
        <p className="font-sans text-xs text-muted-text">
          <span className="font-medium text-dawn-gold">Validation rule: </span>
          Total reductions must equal the current budget shortfall.
        </p>

        {/* Adjustment rows */}
        {availableCategories.length > 0 ? (
          <div className="space-y-3">
            {availableCategories.map((cat) => (
              <AdjustmentRow
                key={cat.category_id}
                category={cat}
                // Object.hasOwn() guard prevents prototype property lookup on
                // server-supplied category_id keys (CWE-94 safe).
                currentValue={Object.hasOwn(adjustments, cat.category_id) ? adjustments[cat.category_id] : 0}
                onAdjust={setAdjustment}
              />
            ))}
          </div>
        ) : (
          <p className="font-sans text-sm text-muted-text">
            No categories available for adjustment.
          </p>
        )}

        {/* Zero-sum balance summary */}
        <ZeroSumSummary
          overspentAmount={overspentAmount}
          totalAdjusted={totalAdjusted}
          balance={balance}
          isZeroSumValid={isZeroSumValid}
        />

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-terracotta/20 bg-terracotta/8 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
            <p className="font-sans text-sm text-terracotta">{error}</p>
          </div>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 border-t border-tactical-border p-6">
        <button
          type="button"
          onClick={handleClose}
          className={cn(
            'rounded-lg border border-tactical-border px-5 py-2.5',
            'font-display text-sm font-medium text-muted-text',
            'transition-colors duration-150 hover:text-pearl-text',
          )}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!isZeroSumValid || isSubmitting}
          className={cn(
            'rounded-lg bg-muted-emerald px-5 py-2.5',
            'font-display text-sm font-semibold text-pearl-text',
            'transition-colors duration-150 hover:bg-muted-emerald/90',
            'disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          {isSubmitting ? 'Applying…' : 'Apply Adjustments'}
        </button>
      </div>
    </>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RebalanceBudgetModal() {
  const isOpen   = useAnalyticsStore((s) => s.isRebalanceModalOpen)
  const onClose  = useAnalyticsStore((s) => s.closeRebalanceModal)

  if (!isOpen) return null

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-lg">
      <ModalBody onClose={onClose} />
    </ModalShell>
  )
}

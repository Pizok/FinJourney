'use client'

/**
 * IncomeAllocationCard.tsx
 *
 * Row 3 left panel (50% width) — income distribution across expense buckets.
 *
 * Visual anatomy:
 *   ┌─ Income Allocation ─────────────────────────────────────────┐
 *   │  See how your income is distributed...                      │
 *   │                                                             │
 *   │  Total Income                           Rp 8,500,000       │
 *   │                                                             │
 *   │  [==Steel (45%)==|==Gold (25%)==|==Emerald (30%)===========]│
 *   │                                                             │
 *   │  ● Essential Expenses     Rp 3,800,000          44.7%      │
 *   │  ● Lifestyle Spending     Rp 2,150,000          25.3%      │
 *   │  ● Remaining Balance      Rp 2,550,000          30.0%      │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Data contract notes:
 *   - baseline_costs   → "Essential Expenses" (Baseline page settings, never
 *                        derived from transaction history per contract)
 *   - variable_spending → "Lifestyle Spending" (actual discretionary spend)
 *   - remaining_amount  → "Remaining Balance" (positive = surplus available
 *                         for savings; negative = deficit)
 *
 * The "Savings & Investments" label from the copy brief represents the
 * intended use of a positive Remaining Balance. When positive, the row is
 * labelled "Remaining Balance" with a soft note about savings potential.
 * When negative, the row shows a deficit state in Terracotta.
 *
 * Animation:
 *   Bar segments animate from 0 → actual width on mount via CSS transition.
 *   A 50ms delay ensures the transition fires after the initial paint.
 *
 * Segment colour semantics:
 *   Steel Violet  → Essential Expenses (fixed, structural)
 *   Dawn Gold     → Lifestyle Spending (variable, behavioural)
 *   Muted Emerald → Remaining Balance (positive surplus)
 *   Terracotta    → Deficit (when remaining_amount < 0)
 *
 * Canonical path: components/analytics/allocation/IncomeAllocationCard.tsx
 */

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useAnalyticsStore } from '../stores/analyticsStore'
import type { IncomeAllocation } from '../types/analytics.types'

// ─── Formatting Utilities ─────────────────────────────────────────────────────

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('id-ID', {
    style:                 'currency',
    currency:              'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

function toPct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.max(0, Math.min(100, (numerator / denominator) * 100))
}

function displayPct(numerator: number, denominator: number): string {
  return `${toPct(numerator, denominator).toFixed(1)}%`
}

// ─── Allocation Bar ───────────────────────────────────────────────────────────

interface AllocationBarProps {
  essentialPct:  number
  lifestylePct:  number
  remainingPct:  number
  isDeficit:     boolean
}

function AllocationBar({
  essentialPct,
  lifestylePct,
  remainingPct,
  isDeficit,
}: AllocationBarProps) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 50)
    return () => clearTimeout(t)
  }, [])

  const transition = 'width 1s cubic-bezier(0.16, 1, 0.3, 1)'

  return (
    <div
      className="flex h-2.5 w-full overflow-hidden rounded-full bg-tactical-border"
      role="img"
      aria-label={`Income allocation: ${essentialPct.toFixed(0)}% essential, ${lifestylePct.toFixed(0)}% lifestyle, ${remainingPct.toFixed(0)}% remaining`}
    >
      {/* Essential Expenses — Steel Violet */}
      <div
        className="h-full shrink-0 bg-steel-violet"
        style={{ width: animated ? `${essentialPct}%` : '0%', transition }}
      />

      {/* Lifestyle Spending — Dawn Gold */}
      <div
        className="h-full shrink-0 bg-dawn-gold"
        style={{ width: animated ? `${lifestylePct}%` : '0%', transition }}
      />

      {/* Remaining Balance — Muted Emerald (surplus) or Terracotta (deficit) */}
      {remainingPct > 0 && (
        <div
          className={cn('h-full shrink-0', isDeficit ? 'bg-terracotta' : 'bg-muted-emerald')}
          style={{ width: animated ? `${remainingPct}%` : '0%', transition }}
        />
      )}
    </div>
  )
}

// ─── Metric Row ───────────────────────────────────────────────────────────────

interface MetricRowProps {
  dotColorClass: string
  label:         string
  amount:        number
  pct:           string
  amountClass?:  string
  isLast?:       boolean
}

function MetricRow({
  dotColorClass,
  label,
  amount,
  pct,
  amountClass = 'text-pearl-text',
  isLast,
}: MetricRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 py-3',
        !isLast && 'border-b border-tactical-border/50',
      )}
    >
      {/* Label + colour dot */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={cn('h-2 w-2 shrink-0 rounded-full', dotColorClass)} />
        <span className="truncate font-sans text-sm text-muted-text">{label}</span>
      </div>

      {/* Amount + percentage */}
      <div className="flex shrink-0 items-baseline gap-3">
        <span className={cn('font-display text-sm font-semibold', amountClass)}>
          {formatCurrency(Math.abs(amount))}
        </span>
        <span className="w-12 text-right font-sans text-xs text-muted-text">
          {pct}
        </span>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function AllocationEmptyState() {
  return (
    <div className="py-8 text-center">
      <p className="font-sans text-sm text-muted-text">
        No income data available for this period.
      </p>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

function AllocationBody({ allocation }: { allocation: IncomeAllocation }) {
  const { total_income, baseline_costs, variable_spending, remaining_amount } = allocation

  const isEmpty   = total_income <= 0
  const isDeficit = remaining_amount < 0

  const essentialPct  = toPct(baseline_costs,    total_income)
  const lifestylePct  = toPct(variable_spending,  total_income)
  const remainingAbs  = Math.abs(remaining_amount)
  const remainingPct  = toPct(remainingAbs,       total_income)

  if (isEmpty) return <AllocationEmptyState />

  return (
    <div className="space-y-5">
      {/* ── Total Income ─────────────────────────────────────────────── */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-sans text-xs uppercase tracking-wide text-muted-text">
          Total Income
        </span>
        <span className="font-display text-xl font-semibold text-pearl-text">
          {formatCurrency(total_income)}
        </span>
      </div>

      {/* ── Stacked Allocation Bar ────────────────────────────────────── */}
      <AllocationBar
        essentialPct={essentialPct}
        lifestylePct={lifestylePct}
        remainingPct={remainingPct}
        isDeficit={isDeficit}
      />

      {/* ── Metric Rows ──────────────────────────────────────────────── */}
      <div>
        <MetricRow
          dotColorClass="bg-steel-violet"
          label="Essential Expenses"
          amount={baseline_costs}
          pct={displayPct(baseline_costs, total_income)}
        />
        <MetricRow
          dotColorClass="bg-dawn-gold"
          label="Lifestyle Spending"
          amount={variable_spending}
          pct={displayPct(variable_spending, total_income)}
        />
        <MetricRow
          dotColorClass={isDeficit ? 'bg-terracotta' : 'bg-muted-emerald'}
          label={isDeficit ? 'Deficit' : 'Remaining Balance'}
          amount={remaining_amount}
          pct={`${isDeficit ? '-' : ''}${displayPct(remainingAbs, total_income)}`}
          amountClass={isDeficit ? 'text-terracotta' : 'text-muted-emerald'}
          isLast
        />
      </div>

      {/* ── Deficit callout ──────────────────────────────────────────── */}
      {isDeficit && (
        <p className="rounded-lg border border-terracotta/20 bg-terracotta/8 px-4 py-2.5 font-sans text-xs leading-relaxed text-terracotta">
          Spending exceeds income this period. Review your Lifestyle Spending
          categories to identify reduction opportunities.
        </p>
      )}
    </div>
  )
}

export function IncomeAllocationCard() {
  const allocation = useAnalyticsStore((s) => s.bootstrap?.income_allocation ?? null)

  return (
    <section
      aria-label="Income Allocation"
      className="rounded-xl border border-tactical-border bg-canvas-surface p-6"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <h2 className="font-display text-base font-semibold text-pearl-text">
          Income Allocation
        </h2>
        <p className="mt-0.5 font-sans text-xs text-muted-text">
          See how your income is distributed across essential expenses,
          lifestyle spending, and savings.
        </p>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {allocation ? (
        <AllocationBody allocation={allocation} />
      ) : (
        <AllocationEmptyState />
      )}
    </section>
  )
}

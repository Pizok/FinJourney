'use client'

/**
 * DebtHealthCard.tsx
 *
 * Row 4 left panel (50% width) — debt exposure and borrowing capacity.
 *
 * Visual anatomy:
 *   ┌─ Debt Health ──────────────────────────────────────────────────┐
 *   │  Monitor your borrowing capacity...                            │
 *   │                                                                │
 *   │  Debt-to-Income Ratio                               18.5%     │
 *   │  [=Emerald 20%=|=Gold 15%=|============Red 65%===========]    │
 *   │           ↑ 18.5%                                             │
 *   │  Good · < 20%    Warning · 20–35%    High · > 35%            │
 *   │                                                                │
 *   │  ─────────────────────────────────────────────────────────    │
 *   │  Active Loans                                        1        │
 *   │  Recommended Debt Limit                  Rp 1,250,000        │
 *   │  Estimated Debt-Free Date                November 2026        │
 *   │                                                                │
 *   │  [Open Loan Simulator →]                                       │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * DTI segmented bar design:
 *   The bar is a linear 0–100% scale. Three background zones mark the
 *   DTI thresholds at low opacity. A filled foreground layer shows the
 *   actual DTI value in the appropriate status colour.
 *
 *   Zones (per PRD thresholds):
 *     Good:    0–20%   → Muted Emerald background
 *     Warning: 20–35%  → Dawn Gold background
 *     Danger:  35–100% → Terracotta background
 *
 * Zero-debt state:
 *   When active_loans === 0, the full metric grid is replaced with a
 *   "debt-free" confirmation. The Safe Loan Limit is still shown since
 *   it represents future borrowing capacity.
 *
 * Fallback rules (no fabrication):
 *   - debt_free_date === null → "Not enough loan data to generate an estimate."
 *   - active_loans === 0     → debt-free confirmation state
 *
 * Canonical path: components/analytics/debt/DebtHealthCard.tsx
 */

import { useState, useEffect } from 'react'
import { FlaskConical, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnalyticsStore } from '../stores/analyticsStore'
import { useAnalyticsData } from '../layout/AnalyticsContext'
import type { DebtHealth, HealthStatus } from '../types/analytics.types'

// ─── Status Config ────────────────────────────────────────────────────────────

// Using a Map instead of a plain Record so that STATUS_CONFIG[status] bracket
// access on server-supplied data is replaced with the safe Map.get() API.
const STATUS_CONFIG = new Map<
  HealthStatus,
  { label: string; colorVar: string; textClass: string; fillClass: string }
>([
  ['good', {
    label:     'Good',
    colorVar:  'var(--color-muted-emerald)',
    textClass: 'text-muted-emerald',
    fillClass: 'bg-muted-emerald',
  }],
  ['warning', {
    label:     'Warning',
    colorVar:  'var(--color-dawn-gold)',
    textClass: 'text-dawn-gold',
    fillClass: 'bg-dawn-gold',
  }],
  ['bad', {
    label:     'High Risk',
    colorVar:  'var(--color-terracotta)',
    textClass: 'text-terracotta',
    fillClass: 'bg-terracotta',
  }],
])

// ─── Formatting ───────────────────────────────────────────────────────────────

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('id-ID', {
    style:                 'currency',
    currency:              'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

function formatDebtFreeDate(dateString: string | null): string {
  if (!dateString) return 'Not enough loan data to generate an estimate.'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// ─── DTI Segmented Bar ────────────────────────────────────────────────────────

interface DtiBarProps {
  dti_percentage: number
  status:         HealthStatus
}

function DtiBar({ dti_percentage, status }: DtiBarProps) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80)
    return () => clearTimeout(t)
  }, [])

  // Map.get() — no bracket notation on server-supplied status value (CWE-94 safe).
  const cfg        = STATUS_CONFIG.get(status)!
  const clampedPct = Math.min(100, Math.max(0, dti_percentage))

  return (
    <div className="space-y-2">
      {/* ── Bar track with zone backgrounds ──────────────────────────── */}
      <div
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-tactical-border"
        role="img"
        aria-label={`DTI: ${dti_percentage.toFixed(1)}%, status ${cfg.label}`}
      >
        {/* Zone backgrounds — low opacity bands marking thresholds */}
        {/* Good zone: 0–20% of bar */}
        <div
          className="absolute inset-y-0 left-0 bg-muted-emerald opacity-20"
          style={{ width: '20%' }}
          aria-hidden="true"
        />
        {/* Warning zone: 20–35% of bar */}
        <div
          className="absolute inset-y-0 bg-dawn-gold opacity-20"
          style={{ left: '20%', width: '15%' }}
          aria-hidden="true"
        />
        {/* Danger zone: 35–100% of bar */}
        <div
          className="absolute inset-y-0 bg-terracotta opacity-10"
          style={{ left: '35%', right: 0 }}
          aria-hidden="true"
        />

        {/* Actual DTI fill — status colour, animates on mount */}
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full', cfg.fillClass)}
          style={{
            width:      animated ? `${clampedPct}%` : '0%',
            transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>

      {/* ── Threshold labels ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between font-sans text-[10px] text-muted-text/70">
        <span>Good · &lt; 20%</span>
        <span>Warning · 20–35%</span>
        <span>High · &gt; 35%</span>
      </div>
    </div>
  )
}

// ─── Metric Row ───────────────────────────────────────────────────────────────

interface MetricRowProps {
  label:      string
  value:      React.ReactNode
  valueClass?: string
  isLast?:    boolean
}

function MetricRow({ label, value, valueClass, isLast }: MetricRowProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 py-3',
        !isLast && 'border-b border-tactical-border/50',
      )}
    >
      <span className="font-sans text-sm text-muted-text">{label}</span>
      <span
        className={cn(
          'text-right font-display text-sm font-semibold text-pearl-text',
          valueClass,
        )}
      >
        {value}
      </span>
    </div>
  )
}

// ─── Zero-Debt State ──────────────────────────────────────────────────────────

function DebtFreeState({ safe_loan_limit }: { safe_loan_limit: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 rounded-lg border border-muted-emerald/20 bg-muted-emerald/8 px-4 py-3">
        <CheckCircle
          className="h-4 w-4 shrink-0 text-muted-emerald"
          strokeWidth={2}
        />
        <p className="font-sans text-sm text-muted-emerald">
          You are currently debt-free.
        </p>
      </div>
      <div>
        <MetricRow
          label="Recommended Debt Limit"
          value={formatCurrency(safe_loan_limit)}
          isLast
        />
      </div>
    </div>
  )
}

// ─── Active Debt State ────────────────────────────────────────────────────────

function ActiveDebtBody({ debt }: { debt: DebtHealth }) {
  const { dti_percentage, status, active_loans, debt_free_date, safe_loan_limit } = debt
  // Map.get() — no bracket notation on server-supplied status value (CWE-94 safe).
  const cfg            = STATUS_CONFIG.get(status)!
  const debtFreeLabel  = formatDebtFreeDate(debt_free_date)
  const isDateUnknown  = debt_free_date === null

  return (
    <div className="space-y-5">
      {/* ── DTI section ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-sans text-sm text-muted-text">
            Debt-to-Income Ratio
          </span>
          <span className={cn('font-display text-xl font-semibold', cfg.textClass)}>
            {dti_percentage.toFixed(1)}%
            <span className="ml-2 font-sans text-xs font-normal text-muted-text">
              {cfg.label}
            </span>
          </span>
        </div>

        <DtiBar dti_percentage={dti_percentage} status={status} />
      </div>

      {/* ── Metric rows ──────────────────────────────────────────────── */}
      <div className="border-t border-tactical-border/50 pt-1">
        <MetricRow
          label="Active Loans"
          value={active_loans}
        />
        <MetricRow
          label="Recommended Debt Limit"
          value={formatCurrency(safe_loan_limit)}
        />
        <MetricRow
          label="Estimated Debt-Free Date"
          value={debtFreeLabel}
          valueClass={isDateUnknown ? 'text-muted-text font-normal text-xs' : undefined}
          isLast
        />
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DebtHealthCard() {
  const { debt_health: debt = null } = useAnalyticsData()
  const openLoanSimulator  = useAnalyticsStore((s) => s.openLoanSimulator)

  return (
    <section
      aria-label="Debt Health"
      className="flex flex-col rounded-xl border border-tactical-border bg-canvas-surface p-6"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <h2 className="font-display text-base font-semibold text-pearl-text">
          Debt Health
        </h2>
        <p className="mt-0.5 font-sans text-xs text-muted-text">
          Monitor your borrowing capacity and understand how debt affects your
          financial flexibility.
        </p>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1">
        {debt ? (
          debt.active_loans === 0 ? (
            <DebtFreeState safe_loan_limit={debt.safe_loan_limit} />
          ) : (
            <ActiveDebtBody debt={debt} />
          )
        ) : (
          <p className="font-sans text-sm text-muted-text">
            Debt data unavailable.
          </p>
        )}
      </div>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      {/*
       * "Open Loan Simulator" — secondary/ghost button per DESIGN.md.
       * No glow. Hover transitions to pearl-text only.
       */}
      <div className="mt-6 pt-5 border-t border-tactical-border/50">
        <button
          type="button"
          onClick={openLoanSimulator}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5',
            'border border-tactical-border font-display text-sm font-medium text-muted-text',
            'transition-colors duration-150 hover:border-steel-violet/40 hover:text-pearl-text',
          )}
          aria-label="Open the loan simulator tool"
        >
          <FlaskConical className="h-4 w-4" strokeWidth={2} />
          Open Loan Simulator
        </button>
      </div>
    </section>
  )
}

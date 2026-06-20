'use client'

/**
 * AssetHealthCard.tsx
 *
 * Row 4 right panel (50% width) — asset foundation and financial resilience.
 *
 * Visual anatomy:
 *   ┌─ Asset Health ──────────────────────────────────────────────────┐
 *   │  Measure the strength of your financial foundation...          │
 *   │                                                                 │
 *   │  Available Cash                          Rp 12,500,000         │
 *   │  Investment Assets                 No investments recorded.     │
 *   │                                                                 │
 *   │  Emergency Runway  ⓘ                                           │
 *   │  3.8 months                                                     │
 *   │  [=========|3M====↑====|6M=====================]              │
 *   │  [0 months]        [Recommended: 6M]                           │
 *   │                                                                 │
 *   │  Savings Target Progress                           42%          │
 *   │  [=========Dawn Gold============================]              │
 *   │                                                                 │
 *   │  [Manage Savings Goals →]                                       │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * Fallback rules (never fabricate):
 *   - invested_assets === 0 → "No investment assets have been recorded yet."
 *     The metric row renders this string instead of "Rp 0" to avoid implying
 *     zero is a valid tracked investment value.
 *
 * Emergency Runway bar:
 *   Visualises survival_runway_months against a 6-month scale (capped at 12).
 *   Benchmark markers at 3M (minimum target) and 6M (recommended target) are
 *   rendered as thin tick marks with labels, giving the user context without
 *   additional chart infrastructure.
 *
 * Savings Target Progress:
 *   Displayed only when savings_target_progress > 0 to avoid a permanently
 *   empty bar for users with no savings target set.
 *   Uses Dawn Gold — the milestone/savings colour per DESIGN.md.
 *
 * Tooltip (Emergency Runway):
 *   Implemented via the `title` attribute on the Info icon for maximum
 *   accessibility and zero component-library dependencies.
 *
 * Canonical path: components/analytics/assets/AssetHealthCard.tsx
 */

import { useState, useEffect } from 'react'
import { Target, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnalyticsStore } from '../stores/analyticsStore'
import type { AssetHealth } from '../types/analytics.types'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Maximum months shown on the runway bar scale.
 * Beyond this cap the bar fills completely (the user is in excellent shape).
 */
const RUNWAY_SCALE_MAX = 12

/** Benchmark month markers rendered on the runway bar */
const RUNWAY_BENCHMARKS = [
  { months: 3, label: '3M', note: 'Minimum'    },
  { months: 6, label: '6M', note: 'Recommended' },
] as const

const RUNWAY_TOOLTIP =
  'The estimated number of months your current assets can support your essential expenses.'

// ─── Formatting ───────────────────────────────────────────────────────────────

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('id-ID', {
    style:                 'currency',
    currency:              'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

// ─── Metric Row ───────────────────────────────────────────────────────────────

interface MetricRowProps {
  label:       string
  value:       React.ReactNode
  valueClass?: string
  isLast?:     boolean
}

function MetricRow({ label, value, valueClass, isLast }: MetricRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 py-3',
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

// ─── Emergency Runway Bar ─────────────────────────────────────────────────────

interface RunwayBarProps {
  months: number
}

function RunwayBar({ months }: RunwayBarProps) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80)
    return () => clearTimeout(t)
  }, [])

  const fillPct     = Math.min(100, (months / RUNWAY_SCALE_MAX) * 100)
  const isHealthy   = months >= 6
  const isWarning   = months >= 3 && months < 6
  const fillClass   = isHealthy ? 'bg-muted-emerald' : isWarning ? 'bg-dawn-gold' : 'bg-terracotta'

  return (
    <div className="space-y-2">
      {/* ── Bar track with benchmark tick marks ──────────────────────── */}
      <div className="relative">
        {/* Track */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-tactical-border">
          {/* Fill */}
          <div
            className={cn('h-full rounded-full', fillClass)}
            style={{
              width:      animated ? `${fillPct}%` : '0%',
              transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>

        {/* Benchmark tick marks — positioned above the bar */}
        {RUNWAY_BENCHMARKS.map(({ months: bm, label }) => {
          const pct = (bm / RUNWAY_SCALE_MAX) * 100
          return (
            <div
              key={label}
              className="absolute -top-3.5 flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${pct}%` }}
              aria-hidden="true"
            >
              {/* Tick line */}
              <div className="mb-0.5 h-3 w-px bg-tactical-border" />
            </div>
          )
        })}
      </div>

      {/* ── Scale labels ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between font-sans text-[10px] text-muted-text/60">
        <span>0 months</span>
        {RUNWAY_BENCHMARKS.map(({ months: bm, label, note }) => (
          <span key={label} className="text-center">
            {label}
            <br />
            <span className="opacity-70">{note}</span>
          </span>
        ))}
        <span>{RUNWAY_SCALE_MAX}M</span>
      </div>
    </div>
  )
}

// ─── Savings Progress Bar ─────────────────────────────────────────────────────

interface SavingsProgressProps {
  progress: number  // 0–100
}

function SavingsProgressBar({ progress }: SavingsProgressProps) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 120)
    return () => clearTimeout(t)
  }, [])

  const clamped = Math.min(100, Math.max(0, progress))

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-sans text-sm text-muted-text">
          Savings Target Progress
        </span>
        <span className="font-display text-sm font-semibold text-dawn-gold">
          {clamped.toFixed(0)}%
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-tactical-border">
        <div
          className="h-full rounded-full bg-dawn-gold"
          style={{
            width:      animated ? `${clamped}%` : '0%',
            transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
    </div>
  )
}

// ─── Asset Body ───────────────────────────────────────────────────────────────

function AssetBody({ asset }: { asset: AssetHealth }) {
  const {
    liquid_cash,
    survival_runway_months,
    savings_target_progress,
  } = asset

  const hasSavingsProgress = savings_target_progress > 0

  return (
    <div className="space-y-5">
      {/* ── Metric rows ──────────────────────────────────────────────── */}
      <div>
        <MetricRow
          label="Available Cash"
          value={formatCurrency(liquid_cash)}
          isLast
        />
      </div>

      {/* ── Emergency Runway ─────────────────────────────────────────── */}
      <div className="space-y-2.5 border-t border-tactical-border/50 pt-4">
        {/* Label row with info tooltip */}
        <div className="flex items-center gap-2">
          <span className="font-sans text-sm text-muted-text">
            Emergency Runway
          </span>
          <span title={RUNWAY_TOOLTIP} className="inline-flex items-center">
            <Info
              className="h-3.5 w-3.5 cursor-default text-muted-text/50"
              strokeWidth={2}
              aria-label={RUNWAY_TOOLTIP}
            />
          </span>
        </div>

        {/* Prominent month display */}
        <p className="font-display text-2xl font-semibold text-pearl-text leading-none">
          {survival_runway_months.toFixed(1)}
          <span className="ml-1.5 font-sans text-sm font-normal text-muted-text">
            months
          </span>
        </p>

        {/* Bar visualisation */}
        <RunwayBar months={survival_runway_months} />
      </div>

      {/* ── Savings Target Progress ───────────────────────────────────── */}
      {hasSavingsProgress && (
        <div className="border-t border-tactical-border/50 pt-4">
          <SavingsProgressBar progress={savings_target_progress} />
        </div>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AssetHealthCard() {
  const asset             = useAnalyticsStore((s) => s.bootstrap?.asset_health ?? null)
  const openSavingsTarget = useAnalyticsStore((s) => s.openSavingsTarget)

  return (
    <section
      aria-label="Asset Health"
      className="flex flex-col rounded-xl border border-tactical-border bg-canvas-surface p-6"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <h2 className="font-display text-base font-semibold text-pearl-text">
          Asset Health
        </h2>
        <p className="mt-0.5 font-sans text-xs text-muted-text">
          Measure the strength of your financial foundation and long-term
          resilience.
        </p>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1">
        {asset ? (
          <AssetBody asset={asset} />
        ) : (
          <p className="font-sans text-sm text-muted-text">
            Asset data unavailable.
          </p>
        )}
      </div>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      {/*
       * "Manage Savings Goals" — secondary/ghost button per DESIGN.md.
       * No glow. Hover transitions to pearl-text. Dawn Gold accent on hover
       * reinforces the savings/milestone semantic for this action.
       */}
      <div className="mt-6 border-t border-tactical-border/50 pt-5">
        <button
          type="button"
          onClick={openSavingsTarget}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5',
            'border border-tactical-border font-display text-sm font-medium text-muted-text',
            'transition-colors duration-150 hover:border-dawn-gold/40 hover:text-pearl-text',
          )}
          aria-label="Open savings target manager"
        >
          <Target className="h-4 w-4" strokeWidth={2} />
          Manage Savings Goals
        </button>
      </div>
    </section>
  )
}

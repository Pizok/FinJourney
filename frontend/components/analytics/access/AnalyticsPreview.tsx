'use client'

/**
 * AnalyticsPreview.tsx
 *
 * Static, non-interactive ghost layout of the Analytics page.
 * Rendered behind AnalyticsLockedOverlay to communicate what the
 * unlocked page looks like without exposing real user data.
 *
 * Architecture notes:
 *  - aria-hidden="true" — purely decorative, never read by screen readers
 *  - pointer-events-none — no interactions possible
 *  - select-none — no text selection
 *  - blur + opacity applied at wrapper level via inline style
 *    (Tailwind blur-sm = 4px; we use a lighter 2px for a subtler effect)
 *
 * Ghost element palette:
 *  - Card backgrounds: bg-canvas-surface (standard dark card)
 *  - Ghost bars / shapes: bg-pearl-text/10 (5–10% white on dark)
 *  - Ghost "chart line" SVG: uses CSS variables for stroke
 *  - All decorative shapes use the design system — no hardcoded hex values
 *
 * Layout mirrors the PRD's Bento Box architecture:
 *  Row 1 — Advisory (full width)
 *  Row 2 — Cashflow (60%) + Top Transactions (40%)
 *  Row 3 — Income Allocation (50%) + Category Breakdown (50%)
 *  Row 4 — Debt Health (50%) + Asset Health (50%)
 *
 * Canonical path: components/analytics/access/AnalyticsPreview.tsx
 */

import React from 'react'
import { cn } from '@/lib/utils'

// ─── Primitive Ghost Elements ─────────────────────────────────────────────────

/** Reusable card shell matching the Analytics grid card style */
function GhostCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-tactical-border bg-canvas-surface p-6',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** A single ghost bar for simulating text lines, metric labels, etc. */
function GhostBar({
  widthClass = 'w-full',
  heightClass = 'h-2.5',
  className,
}: {
  widthClass?: string
  heightClass?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-full bg-pearl-text/10',
        heightClass,
        widthClass,
        className,
      )}
    />
  )
}

/** A circular ghost element for score indicators, icons, etc. */
function GhostCircle({ sizeClass = 'h-12 w-12' }: { sizeClass?: string }) {
  return (
    <div className={cn('rounded-full bg-pearl-text/10', sizeClass)} />
  )
}

// ─── Ghost SVG: Cashflow Line Chart ───────────────────────────────────────────
// Static SVG paths that visually suggest a two-line chart (income / expense).
// Stroke colors reference CSS variables — no hardcoded hex values.

function GhostCashflowChart() {
  return (
    <div className="mt-4 h-36 w-full">
      <svg
        viewBox="0 0 400 100"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* Horizontal axis reference */}
        <line
          x1="0" y1="95" x2="400" y2="95"
          style={{ stroke: 'var(--color-tactical-border)', strokeWidth: 1 }}
        />

        {/* Income line — higher, gently undulating */}
        <path
          d="M 0 28 C 50 24, 100 30, 150 26 C 200 22, 250 28, 300 22 C 340 17, 370 24, 400 20"
          fill="none"
          style={{ stroke: 'var(--color-muted-emerald)', strokeWidth: 2, opacity: 0.7 }}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Income area fill */}
        <path
          d="M 0 28 C 50 24, 100 30, 150 26 C 200 22, 250 28, 300 22 C 340 17, 370 24, 400 20 L 400 95 L 0 95 Z"
          style={{ fill: 'var(--color-muted-emerald)', opacity: 0.07 }}
        />

        {/* Expense line — lower, more volatile */}
        <path
          d="M 0 68 C 50 62, 100 74, 150 65 C 200 56, 250 72, 300 60 C 340 50, 370 64, 400 56"
          fill="none"
          style={{ stroke: 'var(--color-terracotta)', strokeWidth: 2, opacity: 0.45 }}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Expense area fill */}
        <path
          d="M 0 68 C 50 62, 100 74, 150 65 C 200 56, 250 72, 300 60 C 340 50, 370 64, 400 56 L 400 95 L 0 95 Z"
          style={{ fill: 'var(--color-terracotta)', opacity: 0.05 }}
        />
      </svg>
    </div>
  )
}

// ─── Ghost SVG: Category Pie Chart ────────────────────────────────────────────
// Static SVG donut chart with four approximate segments.

function GhostPieChart() {
  // Segments: 4 slices using stroke-dasharray technique on a circle
  // circumference ≈ 2π × 38 ≈ 239
  const r = 38
  const cx = 50
  const cy = 50
  const circumference = 2 * Math.PI * r

  // Approximate segment sizes (out of 100%)
  const segments = [
    { pct: 31, color: 'var(--color-pearl-text)', opacity: 0.15 },
    { pct: 19, color: 'var(--color-pearl-text)', opacity: 0.10 },
    { pct: 13, color: 'var(--color-pearl-text)', opacity: 0.07 },
    { pct: 37, color: 'var(--color-pearl-text)', opacity: 0.05 },
  ]

  let offset = 0
  const slices = segments.map((seg) => {
    const dash = (seg.pct / 100) * circumference
    const gap = circumference - dash
    const currentOffset = offset
    offset += dash
    return { ...seg, dash, gap, offset: currentOffset }
  })

  return (
    <div className="flex items-center justify-center py-2">
      <svg viewBox="0 0 100 100" className="h-28 w-28" aria-hidden="true">
        {/* Background donut ring */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          style={{ stroke: 'var(--color-tactical-border)', strokeWidth: 14 }}
        />
        {/* Segments */}
        {slices.map((s, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            style={{
              stroke: s.color,
              strokeWidth: 14,
              strokeDasharray: `${s.dash} ${s.gap}`,
              strokeDashoffset: -s.offset,
              opacity: s.opacity,
              transform: 'rotate(-90deg)',
              transformOrigin: '50px 50px',
            }}
          />
        ))}
        {/* Center hole label placeholder */}
        <rect x={38} y={44} width={24} height={4} rx={2}
          style={{ fill: 'var(--color-pearl-text)', opacity: 0.12 }} />
        <rect x={42} y={52} width={16} height={3} rx={1.5}
          style={{ fill: 'var(--color-pearl-text)', opacity: 0.08 }} />
      </svg>
    </div>
  )
}

// ─── Row 1: Advisory Ghost ────────────────────────────────────────────────────

function GhostAdvisoryCard() {
  return (
    <GhostCard className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      {/* Left: score + recommendation */}
      <div className="flex flex-1 items-start gap-4">
        {/* Score circle */}
        <GhostCircle sizeClass="h-14 w-14 shrink-0" />

        {/* Text block */}
        <div className="flex-1 space-y-2.5 pt-0.5">
          <GhostBar widthClass="w-2/5" heightClass="h-3" />
          <GhostBar widthClass="w-3/4" heightClass="h-2" />
          <GhostBar widthClass="w-5/6" heightClass="h-2" />
          <GhostBar widthClass="w-1/2" heightClass="h-2" />
        </div>
      </div>

      {/* Right: reduction targets */}
      <div className="flex shrink-0 flex-col gap-3 sm:w-52">
        {[85, 70, 60].map((w, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 rounded-lg border border-tactical-border p-3"
          >
            <GhostBar widthClass={`w-${w === 85 ? '2/3' : w === 70 ? '1/2' : '2/5'}`} heightClass="h-2" />
            <GhostBar widthClass="w-14" heightClass="h-2.5" />
          </div>
        ))}
      </div>
    </GhostCard>
  )
}

// ─── Row 2: Cashflow + Top Transactions ───────────────────────────────────────

function GhostCashflowCard() {
  return (
    <GhostCard className="h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <GhostBar widthClass="w-32" heightClass="h-3" />
        <div className="flex items-center gap-2">
          <GhostBar widthClass="w-16" heightClass="h-2" />
        </div>
      </div>

      {/* Chart area */}
      <GhostCashflowChart />

      {/* Legend */}
      <div className="mt-3 flex items-center gap-5">
        {['Income', 'Expenses'].map((label) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-pearl-text/15" />
            <GhostBar widthClass="w-12" heightClass="h-2" />
          </div>
        ))}
      </div>
    </GhostCard>
  )
}

function GhostTopTransactionsCard() {
  return (
    <GhostCard className="h-full">
      <GhostBar widthClass="w-36" heightClass="h-3" className="mb-5" />

      <div className="space-y-4">
        {[95, 80, 70, 65, 55].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <GhostCircle sizeClass="h-8 w-8 shrink-0" />
            <div className="flex flex-1 items-center justify-between gap-2">
              <div className="space-y-1.5">
                <GhostBar widthClass={`w-${w > 85 ? '28' : w > 75 ? '24' : w > 65 ? '20' : '16'}`} heightClass="h-2.5" />
                <GhostBar widthClass="w-16" heightClass="h-1.5" />
              </div>
              <GhostBar widthClass="w-14" heightClass="h-2.5" />
            </div>
          </div>
        ))}
      </div>
    </GhostCard>
  )
}

// ─── Row 3: Income Allocation + Categories ────────────────────────────────────

function GhostAllocationCard() {
  return (
    <GhostCard>
      <GhostBar widthClass="w-40" heightClass="h-3" className="mb-5" />

      <div className="space-y-4">
        {['Total Income', 'Baseline Costs', 'Variable Spending', 'Remaining'].map(
          (_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <GhostBar widthClass="w-28" heightClass="h-2" />
              <GhostBar widthClass="w-20" heightClass="h-3" />
            </div>
          ),
        )}

        {/* Allocation bar */}
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-pearl-text/10">
          <div className="h-full w-2/3 rounded-full bg-pearl-text/15" />
        </div>
      </div>
    </GhostCard>
  )
}

function GhostCategoriesCard() {
  return (
    <GhostCard>
      <GhostBar widthClass="w-36" heightClass="h-3" className="mb-4" />

      {/* Pie chart */}
      <GhostPieChart />

      {/* Legend items */}
      <div className="mt-2 space-y-2.5">
        {[80, 65, 55, 70].map((w, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-pearl-text/15" />
              <GhostBar widthClass={`w-${w > 75 ? '24' : w > 60 ? '20' : '16'}`} heightClass="h-2" />
            </div>
            <GhostBar widthClass="w-10" heightClass="h-2" />
          </div>
        ))}
      </div>
    </GhostCard>
  )
}

// ─── Row 4: Debt Health + Asset Health ────────────────────────────────────────

function GhostDebtCard() {
  return (
    <GhostCard>
      <GhostBar widthClass="w-28" heightClass="h-3" className="mb-5" />

      {/* DTI gauge / status */}
      <div className="mb-4 flex items-center gap-4">
        <GhostCircle sizeClass="h-14 w-14" />
        <div className="space-y-2">
          <GhostBar widthClass="w-24" heightClass="h-3" />
          <GhostBar widthClass="w-16" heightClass="h-2" />
        </div>
      </div>

      <div className="space-y-3">
        {['Active Loans', 'Debt-Free Date', 'Safe Loan Limit'].map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <GhostBar widthClass="w-24" heightClass="h-2" />
            <GhostBar widthClass="w-20" heightClass="h-2.5" />
          </div>
        ))}
      </div>

      <div className="mt-4">
        <GhostBar widthClass="w-full" heightClass="h-8" className="rounded-lg opacity-70" />
      </div>
    </GhostCard>
  )
}

function GhostAssetCard() {
  return (
    <GhostCard>
      <GhostBar widthClass="w-32" heightClass="h-3" className="mb-5" />

      {/* Survival runway */}
      <div className="mb-4 space-y-2">
        <GhostBar widthClass="w-20" heightClass="h-2" />
        <GhostBar widthClass="w-28" heightClass="h-5" />
      </div>

      {/* Asset allocation bar */}
      <div className="mb-4 space-y-2">
        <GhostBar widthClass="w-36" heightClass="h-2" />
        <div className="flex h-3 w-full overflow-hidden rounded-full">
          <div className="h-full w-3/4 rounded-l-full bg-pearl-text/15" />
          <div className="h-full flex-1 bg-pearl-text/8 rounded-r-full" />
        </div>
      </div>

      {/* Savings progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <GhostBar widthClass="w-28" heightClass="h-2" />
          <GhostBar widthClass="w-10" heightClass="h-2" />
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-pearl-text/10">
          <div className="h-full w-2/5 rounded-full bg-pearl-text/20" />
        </div>
      </div>

      <div className="mt-4">
        <GhostBar widthClass="w-full" heightClass="h-8" className="rounded-lg opacity-70" />
      </div>
    </GhostCard>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AnalyticsPreview() {
  return (
    /*
     * aria-hidden: screen readers skip this entirely — it carries no semantic value.
     * pointer-events-none + select-none: zero interaction surface.
     * filter + opacity: creates the "fogged" locked appearance.
     * The subtle blur (2px) is lighter than Tailwind's blur-sm (4px)
     * for a more restrained aesthetic consistent with DESIGN.md motion rules.
     */
    <div
      aria-hidden="true"
      className="pointer-events-none select-none"
      style={{ filter: 'blur(2px) saturate(0.35)', opacity: 0.55 }}
    >
      <div className="space-y-6">
        {/* Row 1 — Advisory */}
        <GhostAdvisoryCard />

        {/* Row 2 — Cashflow (60%) + Top Transactions (40%) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <GhostCashflowCard />
          </div>
          <div className="lg:col-span-2">
            <GhostTopTransactionsCard />
          </div>
        </div>

        {/* Row 3 — Income Allocation + Category Breakdown */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <GhostAllocationCard />
          <GhostCategoriesCard />
        </div>

        {/* Row 4 — Debt Health + Asset Health */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <GhostDebtCard />
          <GhostAssetCard />
        </div>
      </div>
    </div>
  )
}

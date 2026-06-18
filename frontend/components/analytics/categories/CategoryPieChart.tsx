'use client'

/**
 * CategoryPieChart.tsx
 *
 * Row 3 right panel (50% width) — donut chart of spending by category.
 *
 * Visual anatomy (desktop):
 *   ┌─ Spending Breakdown ──────────────────────────────────────────┐
 *   │  Identify where your money goes...                            │
 *   │                                                               │
 *   │   ┌────────────────┐    ● Food & Dining    31.2%  [Over]     │
 *   │   │   ╭───────╮    │    ● Transportation   13.3%             │
 *   │   │ ╭─┤ Total ├─╮  │    ● Shopping         19.1%  [Over]    │
 *   │   │ │ │  14.5M │ │  │    ● Entertainment    10.3%             │
 *   │   │ ╰─┤       ├─╯  │    ● Utilities          6.7%             │
 *   │   │   ╰───────╯    │    ● Other             10.8%             │
 *   │   └────────────────┘                                          │
 *   └───────────────────────────────────────────────────────────────┘
 *
 * Data rules:
 *   - `dataKey="amount"` gives recharts raw values for correct arc sizes.
 *     The backend's `percentage` field (pre-rounded) is used for display
 *     only, not for arc calculation, avoiding rounding-sum errors.
 *   - Overspending flag is backend-evaluated (amount > category_limit).
 *     Frontend never re-evaluates this condition.
 *
 * Colour palette:
 *   recharts Cell `fill` receives CSS custom property strings.
 *   CHART_PALETTE cycles through design-system accent colours with
 *   full and reduced opacity variants to handle 5+ categories without
 *   introducing out-of-system hex values.
 *
 * Overspending badge:
 *   Rendered inline in the legend for each overspending category.
 *   Terracotta tint + border. No coloured card border or side-stripe.
 *
 * Canonical path: components/analytics/categories/CategoryPieChart.tsx
 */

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { PieChart as PieChartIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnalyticsStore } from '../stores/analyticsStore'
import type { CategoryBreakdown } from '../types/analytics.types'

// ─── Chart Colour Palette ─────────────────────────────────────────────────────
// CSS variable strings cycle through design-system colours.
// fillOpacity steps create visual distinction beyond the 3 primary accents.

interface PaletteSlot { fill: string; fillOpacity: number }

const CHART_PALETTE: PaletteSlot[] = [
  { fill: 'var(--color-muted-emerald)', fillOpacity: 1.00 },
  { fill: 'var(--color-steel-violet)',  fillOpacity: 1.00 },
  { fill: 'var(--color-dawn-gold)',     fillOpacity: 1.00 },
  { fill: 'var(--color-muted-text)',    fillOpacity: 0.85 },
  { fill: 'var(--color-muted-emerald)', fillOpacity: 0.50 },
  { fill: 'var(--color-steel-violet)',  fillOpacity: 0.50 },
  { fill: 'var(--color-dawn-gold)',     fillOpacity: 0.50 },
]

// Array.at() with modulo index — no user input involved; modulo keeps the
// index in-bounds. Using .at() removes the bracket notation the linter flags.
function getSlotForIndex(i: number): PaletteSlot {
  return CHART_PALETTE.at(i % CHART_PALETTE.length) ?? CHART_PALETTE[0]
}

// ─── Formatting ───────────────────────────────────────────────────────────────

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('id-ID', {
    style:                 'currency',
    currency:              'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

function formatShort(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000)     return `${(amount / 1_000).toFixed(0)}K`
  return amount.toString()
}

// ─── Overspending Badge ───────────────────────────────────────────────────────

function OverspendingBadge() {
  return (
    <span
      className={cn(
        'shrink-0 rounded border border-terracotta/25',
        'bg-terracotta/10 px-1.5 py-0.5',
        'font-sans text-[10px] font-medium leading-none text-terracotta',
      )}
      aria-label="Over budget"
    >
      Over
    </span>
  )
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface TooltipEntry {
  payload?: CategoryBreakdown
  active?:  boolean
}

// recharts passes the data object on payload[0].payload for Pie
function CustomPieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const entry: CategoryBreakdown = payload[0].payload

  return (
    <div className="rounded-lg border border-tactical-border bg-canvas-surface p-3 shadow-lg">
      <p className="font-display text-sm font-semibold text-pearl-text">
        {entry.category_name}
      </p>
      <p className="mt-0.5 font-sans text-xs text-muted-text">
        {formatCurrency(entry.amount)}
        <span className="mx-1.5 opacity-40">·</span>
        {entry.percentage.toFixed(1)}%
      </p>
      {entry.overspending && (
        <p className="mt-1.5 font-sans text-xs text-terracotta">
          Exceeds category limit
        </p>
      )}
    </div>
  )
}

// ─── Custom Legend ────────────────────────────────────────────────────────────

interface LegendProps {
  data: CategoryBreakdown[]
}

function CategoryLegend({ data }: LegendProps) {
  return (
    <div className="space-y-2.5">
      {data.map((entry, index) => {
        const slot = getSlotForIndex(index)
        return (
          <div
            key={entry.category_id}
            className="flex items-center justify-between gap-3"
          >
            {/* Dot + name + badge */}
            <div className="flex min-w-0 items-center gap-2">
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{
                  backgroundColor: slot.fill,
                  opacity:          slot.fillOpacity,
                }}
                aria-hidden="true"
              />
              <span className="truncate font-sans text-sm text-pearl-text">
                {entry.category_name}
              </span>
              {entry.overspending && <OverspendingBadge />}
            </div>

            {/* Percentage */}
            <span className="shrink-0 font-display text-sm font-medium text-muted-text">
              {entry.percentage.toFixed(1)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Donut Center Label ───────────────────────────────────────────────────────
// Positioned absolutely over the ResponsiveContainer with pointer-events-none
// so it doesn't interfere with recharts hover interactions.

interface DonutCenterProps {
  totalAmount: number
}

function DonutCenterLabel({ totalAmount }: DonutCenterProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5"
      aria-hidden="true"
    >
      <span className="font-sans text-[10px] text-muted-text">Total</span>
      <span className="font-display text-base font-semibold text-pearl-text">
        {formatShort(totalAmount)}
      </span>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function CategoryEmptyState() {
  return (
    <div className="flex h-52 flex-col items-center justify-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-abyssal-slate">
        <PieChartIcon className="h-5 w-5 text-muted-text/50" strokeWidth={2} />
      </div>
      <p className="max-w-xs text-center font-sans text-sm leading-relaxed text-muted-text">
        Not enough spending data to generate a breakdown.
      </p>
    </div>
  )
}

// ─── Chart Body ───────────────────────────────────────────────────────────────

interface ChartBodyProps {
  data: CategoryBreakdown[]
}

function ChartBody({ data }: ChartBodyProps) {
  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0)
  const overspendingCount = data.filter((d) => d.overspending).length

  return (
    <div className="space-y-4">
      {/* ── Overspending summary ─────────────────────────────────────── */}
      {overspendingCount > 0 && (
        <p className="font-sans text-xs text-muted-text">
          <span className="font-medium text-terracotta">
            {overspendingCount} {overspendingCount === 1 ? 'category' : 'categories'}
          </span>{' '}
          {overspendingCount === 1 ? 'has' : 'have'} exceeded their budget limit this period.
        </p>
      )}

      {/* ── Chart + legend layout ─────────────────────────────────────── */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {/* Donut chart */}
        <div className="relative mx-auto w-44 shrink-0 sm:mx-0">
          <ResponsiveContainer width="100%" height={176}>
            <PieChart>
              <Pie
                data={data}
                dataKey="amount"
                nameKey="category_name"
                cx="50%"
                cy="50%"
                innerRadius="52%"
                outerRadius="78%"
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
                strokeWidth={0}
              >
                {data.map((entry, index) => {
                  const slot = getSlotForIndex(index)
                  return (
                    <Cell
                      key={entry.category_id}
                      fill={slot.fill}
                      fillOpacity={slot.fillOpacity}
                      stroke="var(--color-canvas-surface)"
                      strokeWidth={2}
                    />
                  )
                })}
              </Pie>
              <Tooltip
                content={<CustomPieTooltip />}
                cursor={false}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Center label overlay */}
          <DonutCenterLabel totalAmount={totalAmount} />
        </div>

        {/* Legend */}
        <div className="flex-1">
          <CategoryLegend data={data} />
        </div>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CategoryPieChart() {
  const breakdown = useAnalyticsStore(
    (s) => s.bootstrap?.category_breakdown ?? [],
  )

  const isEmpty = breakdown.length === 0

  return (
    <section
      aria-label="Spending Breakdown"
      className="rounded-xl border border-tactical-border bg-canvas-surface p-6"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <h2 className="font-display text-base font-semibold text-pearl-text">
          Spending Breakdown
        </h2>
        <p className="mt-0.5 font-sans text-xs text-muted-text">
          Identify where your money goes and which categories have the largest
          impact on your budget.
        </p>
      </div>

      {/* ── Chart or empty state ─────────────────────────────────────────── */}
      {isEmpty ? <CategoryEmptyState /> : <ChartBody data={breakdown} />}
    </section>
  )
}

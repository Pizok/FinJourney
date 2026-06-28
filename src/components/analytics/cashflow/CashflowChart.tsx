'use client'

/**
 * CashflowChart.tsx
 *
 * Row 2 left panel (60% width) — line chart of income vs. expense over time.
 *
 * Data rules enforced:
 *   - Income line: income transactions only (backend pre-filtered)
 *   - Expense line: expense transactions only (backend pre-filtered)
 *   - Transfers: strictly excluded — the backend does not include them in
 *     cashflow.series, and this component renders the series as-is.
 *
 * Chart specs (from PRD):
 *   - Two lines: Income (Muted Emerald) + Expense (Terracotta)
 *   - No 3D, no animation, no neon — clean dark-theme optimised lines
 *   - Custom tooltip: shows date + both values formatted as IDR
 *   - X-axis labels: date-sensitive format based on active time range
 *   - Y-axis labels: abbreviated IDR (e.g. "8.5M", "2K")
 *   - Minimal grid: Tactical Border dashes
 *   - ResponsiveContainer: fills available width at fixed height
 *
 * Trend indicator:
 *   Displays cashflow.trend_percentage and cashflow.comparison_period
 *   in the card header alongside the section title.
 *
 * Colour access in recharts:
 *   recharts Line `stroke` accepts any CSS colour value. CSS custom
 *   properties (var(--color-*)) are used instead of hardcoded hex values
 *   to stay aligned with DESIGN.md §4 colour management rules.
 *
 * Canonical path: components/analytics/cashflow/CashflowChart.tsx
 */

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnalyticsStore } from '../stores/analyticsStore'
import { useAnalyticsData } from '../layout/AnalyticsContext'
import type { TimeRange, CashflowDataPoint } from '../types/analytics.types'

// ─── Formatting Utilities ─────────────────────────────────────────────────────

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('id-ID', {
    style:                 'currency',
    currency:              'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

function formatYAxis(value: number): string {
  const abs = Math.abs(value)
  if (abs === 0) return '0'
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${(value / 1_000).toFixed(0)}K`
  return value.toString()
}

function formatXAxisDate(dateString: string, range: TimeRange): string {
  const date = new Date(dateString)
  switch (range) {
    case '1W':
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    case '1M':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    case '1Y':
      return date.toLocaleDateString('en-US', { month: 'short' })
    case 'All':
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface TooltipPayloadEntry {
  dataKey: 'income' | 'expense'
  value:   number
  color:   string
}

interface CustomTooltipProps {
  active?:  boolean
  payload?: TooltipPayloadEntry[]
  label?:   string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  // Using Map.get() instead of LABELS[entry.dataKey] to avoid bracket access
  // on recharts-supplied data (CWE-94 safe).
  const LABELS = new Map<string, string>([['income', 'Income'], ['expense', 'Expense']])

  return (
    <div className="rounded-lg border border-tactical-border bg-canvas-surface p-3 shadow-lg">
      <p className="mb-2 font-sans text-xs text-muted-text">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="font-sans text-sm text-pearl-text">
            {LABELS.get(entry.dataKey) ?? entry.dataKey}:{' '}
            <span className="font-medium">{formatCurrency(entry.value)}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Custom Legend ────────────────────────────────────────────────────────────

function ChartLegend() {
  return (
    <div className="mt-3 flex items-center gap-5">
      {[
        { key: 'income',  label: 'Income',   colorVar: 'var(--color-muted-emerald)' },
        { key: 'expense', label: 'Expenses', colorVar: 'var(--color-terracotta)'   },
      ].map(({ key, label, colorVar }) => (
        <div key={key} className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: colorVar }}
          />
          <span className="font-sans text-xs text-muted-text">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Trend Indicator ──────────────────────────────────────────────────────────

interface TrendIndicatorProps {
  trend_percentage: number | null
  comparison_period: string
}

function TrendIndicator({ trend_percentage, comparison_period }: TrendIndicatorProps) {
  if (trend_percentage == null) {
    return (
      <div className="flex items-center gap-1.5 text-muted-text">
        <span className="font-display text-sm font-semibold">
          --%
        </span>
        <span className="font-sans text-xs">
          {comparison_period}
        </span>
      </div>
    )
  }

  const isPositive = trend_percentage >= 0
  const Icon       = isPositive ? TrendingUp : TrendingDown
  const colorClass = isPositive ? 'text-muted-emerald' : 'text-terracotta'
  const prefix     = isPositive ? '+' : ''

  return (
    <div className={cn('flex items-center gap-1.5', colorClass)}>
      <Icon className="h-4 w-4" strokeWidth={2} />
      <span className="font-display text-sm font-semibold">
        {prefix}{trend_percentage.toFixed(1)}%
      </span>
      <span className="font-sans text-xs text-muted-text">
        {comparison_period}
      </span>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function CashflowEmptyState() {
  return (
    <div className="flex h-52 flex-col items-center justify-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-abyssal-slate">
        <BarChart2 className="h-5 w-5 text-muted-text/50" strokeWidth={2} />
      </div>
      <p className="max-w-xs text-center font-sans text-sm leading-relaxed text-muted-text">
        Not enough transaction history to generate a cashflow trend.
      </p>
    </div>
  )
}

// ─── Chart Body ───────────────────────────────────────────────────────────────

interface CashflowChartBodyProps {
  series:    CashflowDataPoint[]
  timeRange: TimeRange
}

function CashflowChartBody({ series, timeRange }: CashflowChartBodyProps) {
  /*
   * Format date labels for X-axis based on active time range.
   * Recharts receives the raw CashflowDataPoint objects; the xAxisTickFormatter
   * converts ISO date strings to human-readable labels at render time.
   */
  const tickFormatter = (dateString: string) =>
    formatXAxisDate(dateString, timeRange)

  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart
          data={series}
          margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
        >
          {/* ── Grid ──────────────────────────────────────────────────── */}
          <CartesianGrid
            stroke="var(--color-tactical-border)"
            strokeDasharray="4 4"
            vertical={false}
            strokeOpacity={0.6}
          />

          {/* ── Axes ──────────────────────────────────────────────────── */}
          <XAxis
            dataKey="label"
            tickFormatter={tickFormatter}
            tick={{
              fill:       'var(--color-muted-text)',
              fontSize:   11,
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{
              fill:       'var(--color-muted-text)',
              fontSize:   11,
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            width={42}
          />

          {/* ── Tooltip ───────────────────────────────────────────────── */}
          <Tooltip
            content={<CustomTooltip />}
            cursor={{
              stroke:       'var(--color-tactical-border)',
              strokeWidth:  1,
              strokeDasharray: '4 4',
            }}
          />

          {/* ── Income line ───────────────────────────────────────────── */}
          <Line
            type="monotone"
            dataKey="income"
            name="Income"
            stroke="var(--color-muted-emerald)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: 'var(--color-canvas-surface)', strokeWidth: 2 }}
            connectNulls
          />

          {/* ── Expense line ──────────────────────────────────────────── */}
          <Line
            type="monotone"
            dataKey="expense"
            name="Expense"
            stroke="var(--color-terracotta)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: 'var(--color-canvas-surface)', strokeWidth: 2 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      <ChartLegend />
    </>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CashflowChart() {
  const { cashflow } = useAnalyticsData()
  const timeRange = useAnalyticsStore((s) => s.timeRange)

  const isEmpty = !cashflow || cashflow.series.length === 0

  return (
    <section
      aria-label="Cashflow Trend"
      className="flex h-full flex-col rounded-xl border border-tactical-border bg-canvas-surface p-6"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-pearl-text">
            Cashflow Trend
          </h2>
          <p className="mt-0.5 font-sans text-xs text-muted-text">
            Track how money moves in and out over time to identify patterns and
            potential risks.
          </p>
        </div>

        {/* Trend percentage badge — only shown when data is present */}
        {!isEmpty && cashflow && (
          <TrendIndicator
            trend_percentage={cashflow.trend_percentage}
            comparison_period={cashflow.comparison_period}
          />
        )}
      </div>

      {/* ── Chart or Empty State ─────────────────────────────────────────── */}
      <div className="mt-4">
        {isEmpty ? (
          <CashflowEmptyState />
        ) : (
          <CashflowChartBody series={cashflow!.series} timeRange={timeRange} />
        )}
      </div>
    </section>
  )
}

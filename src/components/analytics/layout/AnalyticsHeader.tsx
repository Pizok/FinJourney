'use client'

/**
 * AnalyticsHeader.tsx
 *
 * Page header for the Analytics route.
 *
 * Contains:
 *  - Page title and subtitle
 *  - TimeRangeToggle: button group (1W / 1M / 1Y / All)
 *
 * The selected time range is stored globally in analyticsStore.
 * All analytics sections subscribe to timeRange changes independently —
 * the header itself does not trigger any data fetches.
 *
 * Design rules applied:
 *  - Source Sans 3 (font-display) for headings and toggle labels
 *  - IBM Plex Sans (font-sans) for supporting text
 *  - No glow on any button — hierarchy via weight and color only
 *  - Active state uses a subtle pressed appearance, not Muted Emerald fill
 *    (Muted Emerald fill is reserved for primary CTAs and HP bar per DESIGN.md)
 *  - Inactive hover transitions to pearl-text only
 *
 * Canonical path: components/analytics/layout/AnalyticsHeader.tsx
 */

import { useAnalyticsStore } from '../stores/analyticsStore'
import { TIME_RANGE_OPTIONS, type TimeRange } from '../types/analytics.types'
import { cn } from '@/lib/utils'

// ─── Time Range Toggle ────────────────────────────────────────────────────────

interface TimeRangeToggleProps {
  value: TimeRange
  onChange: (range: TimeRange) => void
  /** When true, the toggle is rendered but non-interactive (locked state preview) */
  disabled?: boolean
}

function TimeRangeToggle({ value, onChange, disabled = false }: TimeRangeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Select time range"
      className={cn(
        'flex items-center gap-1 rounded-lg border border-tactical-border bg-canvas-surface p-1',
        disabled && 'opacity-40 pointer-events-none',
      )}
    >
      {TIME_RANGE_OPTIONS.map((range) => {
        const isActive = value === range
        return (
          <button
            key={range}
            type="button"
            onClick={() => !disabled && onChange(range)}
            disabled={disabled}
            aria-pressed={isActive}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm transition-colors duration-150 font-display font-medium',
              isActive
                ? 'bg-abyssal-slate text-pearl-text'
                : 'text-muted-text hover:text-pearl-text',
            )}
          >
            {range}
          </button>
        )
      })}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AnalyticsHeaderProps {
  /** Pass true when Analytics is locked to visually disable the time range toggle */
  isLocked?: boolean
}

export function AnalyticsHeader({ isLocked = false }: AnalyticsHeaderProps) {
  const timeRange = useAnalyticsStore((s) => s.timeRange)
  const setTimeRange = useAnalyticsStore((s) => s.setTimeRange)

  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      {/* ── Title Block ─────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold text-pearl-text">
          Analytics
        </h1>
        <p className="font-sans text-sm text-muted-text">
          Financial health overview for your journey
        </p>
      </div>

      {/* ── Time Range Toggle ────────────────────────────────────────────── */}
      <TimeRangeToggle
        value={timeRange}
        onChange={setTimeRange}
        disabled={isLocked}
      />
    </header>
  )
}

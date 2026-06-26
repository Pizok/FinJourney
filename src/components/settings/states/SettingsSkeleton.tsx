// ─── SettingsSkeleton.tsx + SettingsErrorState.tsx ───────────────────────────
// Supporting state components for the Settings page loading/error lifecycles.
// Both are exported from this single file for import simplicity.
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import { AlertTriangle, RotateCcw } from 'lucide-react'

// ─── Skeleton ─────────────────────────────────────────────────────────────────

/** Pulse block used by the skeleton layout */
function SkeletonBlock({
  className = '',
}: {
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-tactical-border/40 ${className}`}
    />
  )
}

/** Card skeleton that matches the Settings card layout */
export function SettingsSkeleton() {
  return (
    <div
      aria-label="Loading settings…"
      aria-busy="true"
      className="flex flex-col gap-6"
    >
      {[180, 220, 160, 140, 140].map((height, i) => (
        <div
          key={i}
          className="rounded-xl border border-tactical-border bg-canvas-surface p-8"
          style={{ height }}
        >
          <SkeletonBlock className="mb-3 h-5 w-40" />
          <SkeletonBlock className="mb-6 h-3 w-64" />
          <div className="space-y-3">
            <SkeletonBlock className="h-10 w-full" />
            {i < 2 && <SkeletonBlock className="h-10 w-full" />}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Error State ──────────────────────────────────────────────────────────────

interface SettingsErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function SettingsErrorState({
  message = 'Something went wrong while loading your settings.',
  onRetry,
}: SettingsErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex min-h-screen items-center justify-center bg-abyssal-slate px-6"
    >
      <div className="w-full max-w-md rounded-xl border border-tactical-border bg-canvas-surface p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-terracotta/10">
          <AlertTriangle
            className="text-terracotta"
            size={22}
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>

        <h2 className="font-display text-base font-semibold text-pearl-text">
          Failed to load settings
        </h2>

        <p className="mt-2 font-sans text-sm leading-relaxed text-muted-text">
          {message}
        </p>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={[
              'mt-6 flex w-full items-center justify-center gap-2 rounded-lg',
              'border border-tactical-border py-2.5',
              'font-sans text-sm font-medium text-pearl-text',
              'transition-colors duration-150 hover:bg-pearl-text/5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-emerald',
              'focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface',
            ].join(' ')}
          >
            <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
            Try again
          </button>
        )}
      </div>
    </div>
  )
}

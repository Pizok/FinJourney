'use client'

/**
 * AnalyticsShell.tsx
 *
 * Top-level layout wrapper for the Analytics page.
 *
 * Responsibilities:
 *  1. Reads unlock_status from the Zustand store.
 *  2. Renders a basic inline skeleton while bootstrap data is loading.
 *  3. Renders AnalyticsPreview + AnalyticsLockedOverlay when level < 3.
 *  4. Renders children (the full analytics grid) when level >= 3.
 *
 * TanStack Query integration (Part 2) will hydrate the store via
 * useAnalyticsData(), which calls setBootstrap() and setLoading().
 * This shell is intentionally data-agnostic — it only reads state.
 *
 * Canonical path: components/analytics/layout/AnalyticsShell.tsx
 */

import React from 'react'
import { useAnalyticsStore } from '../stores/analyticsStore'
import { AnalyticsLockedOverlay } from '../access/AnalyticsLockedOverlay'
import { AnalyticsPreview } from '../access/AnalyticsPreview'

// ─── Inline Loading Skeleton ──────────────────────────────────────────────────
// Placeholder until AnalyticsSkeleton.tsx is built in Part 2.
// Matches the rough bento-box shape of the analytics grid.

function BootstrapSkeleton() {
  return (
    <div
      className="animate-pulse space-y-6"
      role="status"
      aria-label="Loading analytics data"
    >
      {/* Row 1 — Advisory card */}
      <div className="h-36 rounded-xl border border-tactical-border bg-canvas-surface" />

      {/* Row 2 — Cashflow + Top Transactions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="h-64 rounded-xl border border-tactical-border bg-canvas-surface lg:col-span-3" />
        <div className="h-64 rounded-xl border border-tactical-border bg-canvas-surface lg:col-span-2" />
      </div>

      {/* Row 3 — Allocation + Categories */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="h-52 rounded-xl border border-tactical-border bg-canvas-surface" />
        <div className="h-52 rounded-xl border border-tactical-border bg-canvas-surface" />
      </div>

      {/* Row 4 — Debt + Assets */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="h-52 rounded-xl border border-tactical-border bg-canvas-surface" />
        <div className="h-52 rounded-xl border border-tactical-border bg-canvas-surface" />
      </div>

      <span className="sr-only">Loading analytics…</span>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AnalyticsShellProps {
  children: React.ReactNode
}

export function AnalyticsShell({ children }: AnalyticsShellProps) {
  const bootstrap = useAnalyticsStore((s) => s.bootstrap)
  const isLoading = useAnalyticsStore((s) => s.isLoading)

  // ── Loading State ──────────────────────────────────────────────────────────
  // Bootstrap is null on first render before TanStack Query fires.
  // Show a lightweight skeleton rather than a blank page.
  if (isLoading || bootstrap === null) {
    return <BootstrapSkeleton />
  }

  // ── Locked State ──────────────────────────────────────────────────────────
  // User has not reached Level 3. Render the ghost preview with the
  // access overlay on top. No data mutations are possible in this state.
  if (!bootstrap.unlock_status.unlocked) {
    return (
      <div className="relative">
        {/*
          AnalyticsPreview is aria-hidden and pointer-events-none.
          It exists purely as a visual teaser behind the overlay.
        */}
        <AnalyticsPreview />

        {/*
          AnalyticsLockedOverlay is positioned absolute inset-0 z-10.
          It acts as a focus trap and communicates the unlock requirements.
        */}
        <AnalyticsLockedOverlay unlock_status={bootstrap.unlock_status} />
      </div>
    )
  }

  // ── Unlocked State ─────────────────────────────────────────────────────────
  // Full analytics grid renders as children passed from page.tsx.
  return <>{children}</>
}

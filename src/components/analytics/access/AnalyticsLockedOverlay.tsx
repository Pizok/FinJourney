'use client'

/**
 * AnalyticsLockedOverlay.tsx
 *
 * Access gate rendered over AnalyticsPreview when the user is below Level 3.
 *
 * Displays:
 *  - Lock icon in a restrained dark container
 *  - "Analytics Locked" heading
 *  - Unlock requirement description
 *  - XP progress bar toward Level 3 (Dawn Gold per DESIGN.md XP color rule)
 *  - "[XP] XP remaining until unlock" label (exact copy from brief)
 *  - Supporting tip for gaining XP faster
 *
 * XP Progress Calculation:
 *  Uses the documented level formula from logic.md:
 *    Level N starts at XP = (N−1)² × 100
 *  This is a fixed constant used for UI display only —
 *  the backend remains the authority for actual XP and level state.
 *
 * Design rules applied:
 *  - No glassmorphism — solid Canvas Surface card only
 *  - No glow on any element
 *  - No pure black backdrop — uses Abyssal Slate at 80% opacity
 *  - Lock icon inside a restrained dark container (DESIGN.md §13.3)
 *  - Dawn Gold for XP bar and XP value (DESIGN.md: "Dawn Gold → XP / milestones")
 *  - Backdrop does not use blur — no glassmorphism
 *
 * Canonical path: components/analytics/access/AnalyticsLockedOverlay.tsx
 */

import { Lock } from 'lucide-react'
import type { UnlockStatus } from '../types/analytics.types'

// ─── XP Progress Calculation ──────────────────────────────────────────────────

/**
 * Derives progress percentage toward the required unlock level.
 *
 * Formula (logic.md): Level N starts at XP = (N−1)² × 100
 *   Level 2 starts at: (2−1)² × 100 = 100 XP
 *   Level 3 starts at: (3−1)² × 100 = 400 XP
 *   Range from Level 2 → 3: 300 XP
 *
 * With xp_remaining = 180:
 *   Current total XP = 400 − 180 = 220
 *   Earned within level 2 span = 220 − 100 = 120
 *   Progress = 120 / 300 = 40%
 */
function deriveXpProgress(unlock_status: UnlockStatus): number {
  const { current_level, required_level, xp_remaining } = unlock_status

  // XP floor for each level boundary (fixed constants from logic.md)
  const requiredLevelStartXP = Math.pow(required_level - 1, 2) * 100
  const currentLevelStartXP = Math.pow(current_level - 1, 2) * 100

  const totalRange = requiredLevelStartXP - currentLevelStartXP
  if (totalRange <= 0) return 0

  const xpEarned = totalRange - xp_remaining
  return Math.max(0, Math.min(100, (xpEarned / totalRange) * 100))
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function XpProgressBar({ percent }: { percent: number }) {
  return (
    <div className="space-y-2.5">
      {/* Track */}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-tactical-border"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-label="XP progress toward Level 3"
      >
        {/* Fill */}
        <div
          className="h-full rounded-full bg-dawn-gold transition-all duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between">
        <span className="font-sans text-xs text-muted-text">
          Level {2}
        </span>
        <span className="font-sans text-xs text-muted-text">
          Level {3}
        </span>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AnalyticsLockedOverlayProps {
  unlock_status: UnlockStatus
}

export function AnalyticsLockedOverlay({
  unlock_status,
}: AnalyticsLockedOverlayProps) {
  const progressPercent = deriveXpProgress(unlock_status)

  return (
    /*
     * Fills the parent's relative container (set in AnalyticsShell).
     * z-10 ensures it renders above AnalyticsPreview.
     * Minimum height prevents the overlay from being too short on
     * pages with little preview content.
     */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="analytics-locked-title"
      aria-describedby="analytics-locked-description"
      className="absolute inset-0 z-10 flex min-h-96 items-center justify-center"
    >
      {/* ── Backdrop ──────────────────────────────────────────────────────── */}
      {/* Abyssal Slate at 80% — never pure black per DESIGN.md */}
      <div className="absolute inset-0 bg-abyssal-slate/80" />

      {/* ── Lock Card ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 mx-4 w-full max-w-sm rounded-xl border border-tactical-border bg-canvas-surface p-8 text-center">

        {/* Lock icon — restrained dark container per DESIGN.md §13.3 */}
        <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-abyssal-slate">
          <Lock
            className="h-5 w-5 text-muted-text"
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>

        {/* ── Heading ─────────────────────────────────────────────────────── */}
        <h2
          id="analytics-locked-title"
          className="font-display text-lg font-semibold text-pearl-text"
        >
          Analytics Locked
        </h2>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <p
          id="analytics-locked-description"
          className="mt-2 font-sans text-sm leading-relaxed text-muted-text"
        >
          Reach Level 3 to unlock advanced insights, financial health analysis,
          and personalized recommendations.
        </p>

        {/* ── XP Progress ─────────────────────────────────────────────────── */}
        <div className="mt-6 space-y-3">
          <XpProgressBar percent={progressPercent} />

          {/* "[XP] XP remaining until unlock" — exact copy from brief */}
          <p className="font-sans text-sm text-muted-text">
            <span className="font-display font-semibold text-dawn-gold">
              {unlock_status.xp_remaining.toLocaleString()} XP
            </span>{' '}
            remaining until unlock
          </p>
        </div>

        {/* ── Supporting Text ──────────────────────────────────────────────── */}
        <p className="mt-5 font-sans text-xs leading-relaxed text-muted-text/70">
          Continue logging transactions and completing daily activities to gain
          XP faster.
        </p>
      </div>
    </div>
  )
}

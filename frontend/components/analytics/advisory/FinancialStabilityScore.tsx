'use client'

/**
 * FinancialStabilityScore.tsx
 *
 * SVG arc gauge displaying the backend-calculated Financial Stability Score.
 *
 * Visual anatomy:
 *   ┌─────────────────────────────────┐
 *   │    ╭───────────────────╮        │
 *   │  ╭ │   +4 this month   │ ╮      │
 *   │  │ │        72         │ │      │
 *   │  │ │     ● Excellent   │ │      │
 *   │  ╰ ╰───────────────────╯ ╯      │
 *   └─────────────────────────────────┘
 *
 * Arc technique: stroke-dasharray on a full circle, rotated so the
 * 90° gap lands at the bottom. This supports smooth CSS transitions
 * without computing arc endpoint coordinates.
 *
 *   Circumference (R=44):  ≈ 276.46
 *   Visible arc (270°):    ≈ 207.35
 *   Gap arc (90°):         ≈ 69.12
 *   Rotation:              rotate(-225 60 60)
 *     → moves 3-o'clock start to bottom-left, gap falls at bottom
 *
 * Backend authority:
 *   The score value is received as a prop only — never computed here.
 *   The status label and status color are UI-only concerns derived
 *   from fixed threshold constants for display purposes.
 *
 * Canonical path: components/analytics/advisory/FinancialStabilityScore.tsx
 */

import { useState, useEffect } from 'react'

// ─── Arc Constants ─────────────────────────────────────────────────────────────

const R            = 44
const CX           = 60
const CY           = 60
const STROKE_W     = 7
const CIRCUMF      = 2 * Math.PI * R       // ≈ 276.46
const VISIBLE_ARC  = (270 / 360) * CIRCUMF // ≈ 207.35
const GAP_ARC      = CIRCUMF - VISIBLE_ARC // ≈ 69.12
const ROTATION     = `rotate(-225 ${CX} ${CY})`

// ─── Status Derivation ────────────────────────────────────────────────────────
// Used for colour and label only — the numeric score is authoritative.

const SCORE_THRESHOLDS = {
  excellent: 75,
  good:      50,
} as const

interface ScoreStatus {
  label:        'Excellent' | 'Good' | 'Attention Needed'
  colorVar:     string
  badgeClasses: string
}

function deriveStatus(score: number): ScoreStatus {
  if (score >= SCORE_THRESHOLDS.excellent) {
    return {
      label:        'Excellent',
      colorVar:     'var(--color-muted-emerald)',
      badgeClasses: 'text-muted-emerald',
    }
  }
  if (score >= SCORE_THRESHOLDS.good) {
    return {
      label:        'Good',
      colorVar:     'var(--color-dawn-gold)',
      badgeClasses: 'text-dawn-gold',
    }
  }
  return {
    label:        'Attention Needed',
    colorVar:     'var(--color-terracotta)',
    badgeClasses: 'text-terracotta',
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface FinancialStabilityScoreProps {
  /** 0–100. Backend-calculated. Frontend must not re-derive. */
  score:       number
  /** Signed delta vs. previous period. Positive = improving. */
  score_trend: number
}

export function FinancialStabilityScore({
  score,
  score_trend,
}: FinancialStabilityScoreProps) {
  // Animate arc from 0 → actual score on mount (pure display enhancement)
  const [displayScore, setDisplayScore] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setDisplayScore(score), 80)
    return () => clearTimeout(t)
  }, [score])

  const status    = deriveStatus(score)
  const filledArc = (displayScore / 100) * VISIBLE_ARC
  // Remaining = full circumference minus filled segment
  // (the gap arc is already baked into the dasharray rotation)
  const emptyArc  = CIRCUMF - filledArc

  const trendLabel  = score_trend >= 0 ? `+${score_trend}` : `${score_trend}`
  const trendColor  = score_trend >= 0 ? 'var(--color-muted-emerald)' : 'var(--color-terracotta)'

  return (
    <div
      className="flex flex-col items-center"
      role="img"
      aria-label={`Financial Stability Score: ${score} out of 100. Status: ${status.label}. ${trendLabel} points this month.`}
    >
      {/* ── Gauge SVG ─────────────────────────────────────────────────────── */}
      <div className="w-36">
        <svg
          viewBox="0 0 120 105"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
          aria-hidden="true"
        >
          {/* Background track */}
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            strokeWidth={STROKE_W}
            strokeLinecap="round"
            style={{ stroke: 'var(--color-tactical-border)' }}
            strokeDasharray={`${VISIBLE_ARC} ${GAP_ARC}`}
            transform={ROTATION}
          />

          {/* Score fill — transitions on dasharray change */}
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            strokeWidth={STROKE_W}
            strokeLinecap="round"
            style={{
              stroke:           status.colorVar,
              strokeDasharray:  `${filledArc} ${emptyArc}`,
              transition:       'stroke-dasharray 1s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            transform={ROTATION}
          />

          {/* Trend line (above score) */}
          <text
            x={CX}
            y={46}
            textAnchor="middle"
            fontSize={11}
            style={{
              fill:       trendColor,
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          >
            {trendLabel} this month
          </text>

          {/* Score number */}
          <text
            x={CX}
            y={70}
            textAnchor="middle"
            fontSize={30}
            fontWeight={600}
            style={{
              fill:       'var(--color-pearl-text)',
              fontFamily: "'Source Sans 3', sans-serif",
            }}
          >
            {displayScore}
          </text>

          {/* Status label */}
          <text
            x={CX}
            y={86}
            textAnchor="middle"
            fontSize={10}
            fontWeight={500}
            style={{
              fill:       status.colorVar,
              fontFamily: "'Source Sans 3', sans-serif",
            }}
          >
            {status.label}
          </text>
        </svg>
      </div>
    </div>
  )
}

'use client'

/**
 * AdvisoryCard.tsx
 *
 * Row 1 of the Analytics bento grid — the widest, most prominent card.
 *
 * Layout (desktop):
 *   ┌─ Financial Advisory ──────────────────────────────────────────────────┐
 *   │  ┌──── Left (40%) ──────────────┐  ┌──── Right (60%) ─────────────┐  │
 *   │  │  FinancialStabilityScore     │  │  [Priority Badge]            │  │
 *   │  │  gauge + score + trend       │  │  Advisory Headline           │  │
 *   │  │                              │  │  Recommendation text         │  │
 *   │  │  Score description text      │  │                              │  │
 *   │  │                              │  │  Reduce these categories:    │  │
 *   │  │  [View Recommendations ↓]    │  │  ○ Category    -Rp150,000   │  │
 *   │  └──────────────────────────────┘  │  [Rebalance Budget →]        │  │
 *   │                                    └──────────────────────────────┘  │
 *   └───────────────────────────────────────────────────────────────────────┘
 *
 * Null advisory state:
 *   If advisory is null (no active issue), the right column shows the
 *   status description only — no reduction targets, no Rebalance button.
 *
 * Panel state:
 *   isRecommendationsPanelOpen is managed locally; the RecommendationsPanel
 *   renders as a sibling (not inside the card) for clean layout separation.
 *
 * Design rules:
 *   - "View Recommendations" uses secondary/ghost button style (no glow)
 *   - "Rebalance Budget" opens the store modal (no glow)
 *   - Priority badge: background tint + matching text colour, no side stripe
 *   - Reduction targets: plain rows, no accent borders on individual items
 *
 * Canonical path: components/analytics/advisory/AdvisoryCard.tsx
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, ArrowRightLeft, Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAnalyticsStore } from '../stores/analyticsStore'
import { useAnalyticsData } from '../layout/AnalyticsContext'
import type { AdvisoryPriority, SuggestedAction } from '../types/analytics.types'
import { FinancialStabilityScore } from './FinancialStabilityScore'
import { RecommendationsPanel } from './RecommendationsPanel'

// ─── Priority Display Config ──────────────────────────────────────────────────

// Using a Map instead of a plain Record so that PRIORITY_DISPLAY[advisory.priority]
// bracket access on server-supplied data is replaced with the safe Map.get() API.
const PRIORITY_DISPLAY = new Map<
  AdvisoryPriority,
  { label: string; badgeClasses: string }
>([
  ['insufficient_data', { label: 'Information',       badgeClasses: 'bg-muted-emerald/10 text-muted-emerald border-muted-emerald/20' }],
  ['critical_debt',     { label: 'Debt Risk',         badgeClasses: 'bg-terracotta/10 text-terracotta border-terracotta/20'        }],
  ['upcoming_payment',  { label: 'Payment Risk',      badgeClasses: 'bg-terracotta/10 text-terracotta border-terracotta/20'        }],
  ['overspending',      { label: 'Overspending Alert',badgeClasses: 'bg-dawn-gold/10 text-dawn-gold border-dawn-gold/20'          }],
  ['savings_target',    { label: 'Savings Behind',    badgeClasses: 'bg-dawn-gold/10 text-dawn-gold border-dawn-gold/20'          }],
  ['optimization',      { label: 'Optimization',      badgeClasses: 'bg-muted-emerald/10 text-muted-emerald border-muted-emerald/20' }],
])

// ─── Currency Formatting ──────────────────────────────────────────────────────

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('id-ID', {
    style:                 'currency',
    currency:              'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Single reduction target row inside the right action column.
 * Plain bordered row — no coloured side-stripe (DESIGN.md absolute ban).
 */
function SuggestedActionRow({ target }: { target: SuggestedAction }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-tactical-border/50 bg-abyssal-slate/30 px-3 py-2">
      <span className="font-sans text-xs text-muted-text">
        Reduce <span className="font-medium text-pearl-text">{target.category_name}</span>
      </span>
      <span className="font-mono text-xs font-semibold text-terracotta">
        -{formatCurrency(target.reduction_amount)}
      </span>
    </div>
  )
}

/**
 * Right action column — shown only when an advisory is active.
 * Contains the reduction targets and Rebalance Budget button.
 */
function AdvisoryActionColumn() {
  const { advisory }       = useAnalyticsData()
  const openRebalanceModal = useAnalyticsStore((s) => s.openRebalanceModal)

  if (!advisory || advisory.suggested_actions.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {/* ── Section label ─────────────────────────────────────────────── */}
      <p className="font-sans text-xs uppercase tracking-wide text-muted-text">
        Reduce these categories
      </p>

      {/* ── Reduction targets ─────────────────────────────────────────── */}
      <div className="space-y-2">
        {advisory.suggested_actions.map((target: SuggestedAction) => (
          <SuggestedActionRow key={target.category_name} target={target} />
        ))}
      </div>

    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdvisoryCard() {
  const { advisory, financial_stability: stability } = useAnalyticsData()

  const [isPanelOpen, setIsPanelOpen] = useState(false)

  // Guard: if stability data isn't yet available, render nothing
  // (AnalyticsShell handles the loading skeleton)
  if (!stability) return null

  // Map.get() — no bracket notation on server-supplied advisory.priority (CWE-94 safe).
  const priorityConfig = advisory ? PRIORITY_DISPLAY.get(advisory.priority) ?? null : null

  // The description shown under the gauge. Use backend explanation if provided,
  // otherwise fall back to the static "what is this score?" copy.
  const scoreDescription =
    stability.explanation.trim().length > 0
      ? stability.explanation
      : 'A snapshot of your overall financial health based on spending habits, savings progress, cashflow consistency, and debt exposure.'

  return (
    /*
     * The card and RecommendationsPanel are siblings inside a space-y-4
     * wrapper so the panel expands below the card without affecting card height.
     */
    <div className="space-y-4">
      {/* ── Advisory Card ────────────────────────────────────────────────── */}
      <section
        aria-label="Financial Advisory"
        className="rounded-xl border border-tactical-border bg-canvas-surface p-6"
      >
        {/* ── Section Header ─────────────────────────────────────────────── */}
        <p className="mb-5 font-sans text-xs uppercase tracking-wide text-muted-text">
          Financial Advisory
        </p>

        {/* ── Two-column body ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-12 lg:items-start">

          {/* ── Left: Score + description + panel toggle ─────────────────── */}
          <div className="flex flex-col items-center gap-4 lg:w-56 lg:shrink-0">
            <FinancialStabilityScore
              score={stability.score}
              score_trend={stability.score_trend}
            />

            {/* Score description */}
            <p className="max-w-prose font-sans text-sm leading-relaxed text-muted-text lg:text-center">
              {scoreDescription}
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger type="button" className="ml-1.5 inline-block align-text-bottom focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pearl-text rounded-sm">
                    <Info className="h-4 w-4 text-tactical-text hover:text-pearl-text cursor-help transition-colors" />
                    <span className="sr-only">Score calculation details</span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px] p-3 text-sm">
                    Category spending and Cashflow include credit card commitments, as the score measures overall financial liabilities, not just pure cash flow.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </p>

            {/* View Recommendations toggle */}
            <button
              type="button"
              onClick={() => setIsPanelOpen((prev) => !prev)}
              aria-expanded={isPanelOpen}
              aria-controls="recommendations-panel"
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2',
                'border font-display text-sm font-medium transition-colors duration-150',
                isPanelOpen
                  ? 'border-muted-emerald/40 text-muted-emerald'
                  : 'border-tactical-border text-muted-text hover:border-tactical-border/70 hover:text-pearl-text',
              )}
            >
              {isPanelOpen ? (
                <>
                  <ChevronUp className="h-4 w-4" strokeWidth={2} />
                  Hide Recommendations
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" strokeWidth={2} />
                  View Recommendations
                </>
              )}
            </button>
          </div>

          {/* ── Divider (desktop only) ────────────────────────────────────── */}
          <div className="hidden w-px self-stretch bg-tactical-border lg:block" />

          {/* ── Right: Advisory content ───────────────────────────────────── */}
          <div className="flex flex-1 flex-col gap-5">

            {advisory ? (
              <>
                {/* Priority badge */}
                <span
                  className={cn(
                    'inline-flex w-fit items-center rounded-md border px-2.5 py-0.5',
                    'font-sans text-xs font-medium uppercase tracking-wide',
                    priorityConfig!.badgeClasses,
                  )}
                >
                  {priorityConfig!.label}
                </span>

                {/* Advisory headline */}
                <h2 className="font-display text-lg font-semibold text-pearl-text leading-snug">
                  {advisory.headline}
                </h2>

                {/* Recommendation text */}
                <p className="font-sans text-sm leading-relaxed text-muted-text">
                  {advisory.recommendation}
                </p>

                {/* Inline reduction targets strictly for overspending priority */}
                {advisory.priority === 'overspending' && advisory.suggested_actions.length > 0 && (
                  <div className="flex flex-col gap-3 mt-2">
                    <p className="font-sans text-xs uppercase tracking-wide text-muted-text">
                      Overspent Categories
                    </p>
                    <div className="space-y-2">
                      {advisory.suggested_actions.map((target) => (
                        <div key={target.category_name} className="flex items-center justify-between rounded-md border border-tactical-border/50 bg-abyssal-slate/30 px-3 py-2">
                          <span className="font-sans text-xs text-muted-text">
                            <span className="font-medium text-pearl-text">{target.category_name}</span>
                          </span>
                          <span className="font-mono text-xs font-semibold text-terracotta">
                            -{formatCurrency(target.reduction_amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* No active advisory — finances are healthy */
              <div className="flex flex-1 flex-col justify-center gap-2">
                <span
                  className={cn(
                    'inline-flex w-fit items-center rounded-md border px-2.5 py-0.5',
                    'border-muted-emerald/20 bg-muted-emerald/10 font-sans text-xs font-medium uppercase tracking-wide text-muted-emerald',
                  )}
                >
                  All Clear
                </span>
                <h2 className="font-display text-lg font-semibold text-pearl-text">
                  Your finances are on track
                </h2>
                <p className="max-w-prose font-sans text-sm leading-relaxed text-muted-text">
                  No critical issues detected. Continue logging transactions and
                  reviewing your spending patterns to maintain your score.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Recommendations Panel ─────────────────────────────────────────── */}
      <div id="recommendations-panel">
        <RecommendationsPanel
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
        />
      </div>
    </div>
  )
}

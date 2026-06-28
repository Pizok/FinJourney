'use client'

/**
 * RecommendationsPanel.tsx
 *
 * Collapsible panel that displays personalised financial recommendations.
 * Rendered immediately below AdvisoryCard, controlled by AdvisoryCard state.
 *
 * Expand/collapse animation uses the CSS Grid fr trick:
 *   closed → grid-template-rows: 0fr  (inner div clipped to 0 height)
 *   open   → grid-template-rows: 1fr  (inner div expands to full content height)
 * This avoids brittle max-height hacks and animates smoothly with
 * a single CSS transition property.
 *
 * Data:
 *   In this phase, recommendations are passed as props.
 *   The parent (AdvisoryCard) derives them from the advisory data and
 *   passes EXAMPLE_RECOMMENDATIONS as the default mock set.
 *   A future analytics/recommendations endpoint will supply live data.
 *
 * Design rules:
 *   - No side-stripe borders on items (DESIGN.md §13 absolute ban)
 *   - Priority conveyed via icon + text colour, not coloured card borders
 *   - No glassmorphism, no glow
 *   - Lucide icons at strokeWidth={2}
 *
 * Canonical path: components/analytics/advisory/RecommendationsPanel.tsx
 */

import { X, AlertTriangle, TrendingUp, CheckCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnalyticsData } from '../layout/AnalyticsContext'
import type { AdvisoryPriority } from '../types/analytics.types'

// ─── Priority Config ──────────────────────────────────────────────────────────

// Using a Map instead of a plain Record so that PRIORITY_CONFIG[item.priority]
// (bracket access with server-supplied data) is replaced with the safe Map.get() API.
const PRIORITY_CONFIG = new Map<
  AdvisoryPriority,
  {
    Icon:         typeof AlertTriangle
    iconClass:    string
    labelClass:   string
    label:        string
    containerCls: string
  }
>([
  ['critical_debt', {
    Icon:         AlertTriangle,
    iconClass:    'text-terracotta',
    labelClass:   'text-terracotta',
    label:        'High Priority',
    containerCls: 'border-terracotta/15',
  }],
  ['upcoming_payment', {
    Icon:         AlertTriangle,
    iconClass:    'text-terracotta',
    labelClass:   'text-terracotta',
    label:        'High Priority',
    containerCls: 'border-terracotta/15',
  }],
  ['overspending', {
    Icon:         TrendingUp,
    iconClass:    'text-dawn-gold',
    labelClass:   'text-dawn-gold',
    label:        'Medium Priority',
    containerCls: 'border-dawn-gold/15',
  }],
  ['savings_target', {
    Icon:         TrendingUp,
    iconClass:    'text-dawn-gold',
    labelClass:   'text-dawn-gold',
    label:        'Medium Priority',
    containerCls: 'border-dawn-gold/15',
  }],
  ['optimization', {
    Icon:         CheckCircle,
    iconClass:    'text-muted-emerald',
    labelClass:   'text-muted-emerald',
    label:        'Low Priority',
    containerCls: 'border-tactical-border',
  }],
  ['insufficient_data', {
    Icon:         Info,
    iconClass:    'text-muted-emerald',
    labelClass:   'text-muted-emerald',
    label:        'Information',
    containerCls: 'border-tactical-border',
  }],
])

// ─── Sub-components ───────────────────────────────────────────────────────────

function RecommendationRow({ item }: { item: { title: string, description: string, priority: AdvisoryPriority } }) {
  // Map.get() — no bracket notation on server-supplied priority value (CWE-94 safe).
  const config = PRIORITY_CONFIG.get(item.priority)!
  const { Icon } = config

  return (
    <div
      className={cn(
        'rounded-lg border bg-abyssal-slate/50 p-4 transition-colors duration-150',
        'hover:border-tactical-border/70',
        config.containerCls,
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon container — restrained dark container per DESIGN.md §13.3 */}
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas-surface">
          <Icon className={cn('h-4 w-4', config.iconClass)} strokeWidth={2} />
        </div>

        {/* Text */}
        <div className="flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-display text-sm font-semibold text-pearl-text">
              {item.title}
            </p>
            <span className={cn('shrink-0 font-sans text-xs', config.labelClass)}>
              {config.label}
            </span>
          </div>
          <p className="font-sans text-sm leading-relaxed text-muted-text">
            {item.description}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface RecommendationsPanelProps {
  isOpen:          boolean
  onClose:         () => void
}

export function RecommendationsPanel({
  isOpen,
  onClose,
}: RecommendationsPanelProps) {
  const { advisory } = useAnalyticsData();
  
  let recommendations: { id: string, title: string, description: string, priority: AdvisoryPriority }[] = [];
  
  if (advisory) {
    if (advisory.suggested_actions && advisory.suggested_actions.length > 0) {
      recommendations = advisory.suggested_actions.map((action, i) => ({
        id: `action-${i}`,
        title: `Reduce ${action.category_name} Spending`,
        description: `Cut ${action.category_name} by Rp${action.reduction_amount.toLocaleString('id-ID')} to bring it back within your monthly budget.`,
        priority: advisory.priority,
      }));
    } else {
      recommendations = [{
        id: 'primary',
        title: advisory.headline,
        description: advisory.recommendation,
        priority: advisory.priority,
      }];
    }
  }

  return (
    /*
     * CSS Grid fr trick for smooth expand/collapse.
     * - Closed: grid-rows-[0fr] clips the inner wrapper to zero height.
     * - Open:   grid-rows-[1fr] lets the inner wrapper grow to full height.
     * The 300ms duration matches the "subtle, smooth, premium" motion rule.
     */
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-300 ease-out',
        isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
      aria-hidden={!isOpen}
    >
      <div className="overflow-hidden">
        <div className="rounded-xl border border-tactical-border bg-canvas-surface p-6">

          {/* ── Panel Header ────────────────────────────────────────────── */}
          <div className="mb-5 flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="font-display text-base font-semibold text-pearl-text">
                Personalized Recommendations
              </h3>
              <p className="font-sans text-xs text-muted-text">
                {recommendations.length} action
                {recommendations.length !== 1 ? 's' : ''} identified
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close recommendations"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg',
                'text-muted-text transition-colors duration-150 hover:text-pearl-text',
                'border border-tactical-border bg-abyssal-slate/50',
              )}
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          {/* ── Recommendations List ─────────────────────────────────────── */}
          {recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((item) => (
                <RecommendationRow key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="font-sans text-sm text-muted-text">
                No recommendations at this time. Keep up the good work.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

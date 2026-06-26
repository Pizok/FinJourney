// ─── PreferencesCard.tsx ─────────────────────────────────────────────────────
// Card 4: Preferences & Experience
//
// Controls:
//   1. Theme — segmented control: Light / Dark / System
//   2. Reduced Motion — toggle; disables CSS animations app-wide
//   2. Reduced Motion — toggle; disables CSS animations app-wide
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import { useId } from 'react'
import { Sun, Moon, Monitor, Eye, EyeOff, Zap } from 'lucide-react'
import {
  useSettingsStore,
  selectCurrentPreferences,
} from '../store/settingsStore'
import { Toggle } from '../shared/Toggle'
import type { ThemePreference } from '../types/settings.types'

// ─── Theme option metadata ────────────────────────────────────────────────────
// (Removed as requested)

// ─── ToggleRow ────────────────────────────────────────────────────────────────
// Shared pattern for a labelled toggle with a description line.
// Separator lines between rows are handled by the parent container.

interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** Optional badge text (e.g. "Beta", "New") */
  badge?: string
  /** Optional secondary icon to the left of the label */
  Icon?: React.ElementType
  iconClass?: string
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  badge,
  Icon,
  iconClass = 'text-muted-text',
}: ToggleRowProps) {
  const id = useId()
  const descId = useId()

  return (
    <div className="flex items-start justify-between gap-6 py-5">
      {/* Text block */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {Icon && (
            <Icon
              className={['shrink-0', iconClass].join(' ')}
              size={14}
              strokeWidth={2}
              aria-hidden="true"
            />
          )}
          <label
            htmlFor={id}
            className="cursor-pointer font-sans text-sm font-medium text-pearl-text"
          >
            {label}
          </label>
          {badge && (
            <span
              className={[
                'rounded bg-steel-violet/15 px-1.5 py-0.5',
                'font-sans text-[10px] font-semibold uppercase tracking-wider text-steel-violet',
              ].join(' ')}
            >
              {badge}
            </span>
          )}
        </div>
        <p id={descId} className="mt-0.5 font-sans text-xs leading-relaxed text-muted-text">
          {description}
        </p>
      </div>

      {/* Toggle */}
      <div className="mt-0.5 shrink-0">
        <Toggle
          id={id}
          checked={checked}
          onChange={onChange}
          aria-describedby={descId}
        />
      </div>
    </div>
  )
}

// ─── PreferencesCard ──────────────────────────────────────────────────────────

export function PreferencesCard() {
  const preferences = useSettingsStore(selectCurrentPreferences)
  const updatePreferences = useSettingsStore((s) => s.updatePreferences)

  return (
    <section
      id="preferences"
      aria-labelledby="preferences-heading"
      className="rounded-xl border border-tactical-border bg-canvas-surface scroll-mt-32"
    >
      {/* Card Header */}
      <div className="border-b border-tactical-border px-8 py-6">
        <h2
          id="preferences-heading"
          className="font-display text-base font-semibold text-pearl-text"
        >
          Preferences & Experience
        </h2>
        <p className="mt-0.5 font-sans text-sm text-muted-text">
          Controls local app rendering and privacy behaviour.
        </p>
      </div>

      {/* Card Body */}
      <div className="px-8">

        {/* ── Reduced Motion ─────────────────────────────────────────────── */}
        <ToggleRow
          label="Reduced Motion"
          description="Disable animations, transitions, and motion effects across the entire app. Improves performance on lower-end devices."
          checked={preferences.reduced_motion}
          onChange={(val) => updatePreferences({ reduced_motion: val })}
          Icon={Zap}
          iconClass={preferences.reduced_motion ? 'text-muted-emerald' : 'text-muted-text'}
        />

      </div>
    </section>
  )
}

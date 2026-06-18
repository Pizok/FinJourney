// ─── PreferencesCard.tsx ─────────────────────────────────────────────────────
// Card 4: Preferences & Experience
//
// Controls:
//   1. Theme — segmented control: Light / Dark / System
//   2. Reduced Motion — toggle; disables CSS animations app-wide
//   3. Privacy Mode — toggle; masks financial values on Dashboard/Wallet/Analytics
//
// Privacy Mode global access:
//   The `selectPrivacyMode` selector is exported from this file so that any
//   page outside Settings can read the current mask state:
//
//     import { selectPrivacyMode } from '@/components/settings/preferences/PreferencesCard'
//     const isPrivate = useSettingsStore(selectPrivacyMode)
//     // then: value = isPrivate ? 'Rp ***.***' : formatRupiah(amount)
//
//   NOTE: The selector depends on the store being hydrated. Pages that render
//   before the user visits Settings should fetch their own privacy_mode from
//   the /api/v1/settings or /me/bootstrap endpoint independently.
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

// ─── Public selector — import on Dashboard / Wallet / Analytics ───────────────

/**
 * Reads the current privacy mode preference from the global settings store.
 *
 * Usage on any page:
 *   ```ts
 *   import { selectPrivacyMode } from '@/components/settings/preferences/PreferencesCard'
 *   const isPrivate = useSettingsStore(selectPrivacyMode)
 *   const display = isPrivate ? 'Rp ***.***' : formatRupiah(amount)
 *   ```
 *
 * Scope: values are masked on Dashboard, Wallet, and Analytics.
 * Values within Settings inputs remain visible (editing requires the real value).
 */
export const selectPrivacyMode = (state: {
  currentSettings: { preferences: { privacy_mode: boolean } }
}) => state.currentSettings.preferences.privacy_mode

// ─── Theme option metadata ────────────────────────────────────────────────────

interface ThemeOption {
  value: ThemePreference
  label: string
  Icon: React.ElementType
  /** Accessible description for screen readers */
  description: string
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: 'light',
    label: 'Light',
    Icon: Sun,
    description: 'Always use the light theme',
  },
  {
    value: 'dark',
    label: 'Dark',
    Icon: Moon,
    description: 'Always use the dark theme',
  },
  {
    value: 'system',
    label: 'System',
    Icon: Monitor,
    description: 'Follow the operating system setting',
  },
]

// ─── ThemeSelector ────────────────────────────────────────────────────────────
// Custom segmented radio group — not a select/dropdown.
// Three adjacent buttons sharing a container with rounded-lg edges.
//
// Active option: bg-canvas-surface (lighter than the container's abyssal-slate)
// Inactive option: text-muted-text, hover → text-pearl-text

interface ThemeSelectorProps {
  value: ThemePreference
  onChange: (theme: ThemePreference) => void
}

function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const groupId = useId()

  return (
    <div
      role="radiogroup"
      aria-label="Theme preference"
      id={groupId}
      className={[
        'flex rounded-lg border border-tactical-border',
        'bg-abyssal-slate p-0.5',
        // Ensure all options share equal width
        'w-full sm:w-auto sm:inline-flex',
      ].join(' ')}
    >
      {THEME_OPTIONS.map((opt, index) => {
        const isActive = value === opt.value
        const isFirst = index === 0
        const isLast = index === THEME_OPTIONS.length - 1

        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={opt.description}
            onClick={() => onChange(opt.value)}
            className={[
              'flex flex-1 items-center justify-center gap-1.5',
              'px-4 py-2 sm:flex-none',
              'font-sans text-sm font-medium',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
              'focus-visible:ring-muted-emerald',
              // Shape — rounded corners only on first and last to avoid double radius
              isFirst ? 'rounded-l-md' : '',
              isLast ? 'rounded-r-md' : '',
              !isFirst && !isLast ? 'rounded-none' : '',
              // Colour
              isActive
                ? 'bg-canvas-surface text-pearl-text shadow-sm'
                : 'bg-transparent text-muted-text hover:text-pearl-text',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <opt.Icon
              className={isActive ? 'text-pearl-text' : 'text-muted-text/70'}
              size={13}
              strokeWidth={2}
              aria-hidden="true"
            />
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

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
      className="rounded-xl border border-tactical-border bg-canvas-surface scroll-mt-8"
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

        {/* ── Theme ──────────────────────────────────────────────────────── */}
        <div className="py-5">
          <div className="mb-3 flex items-center gap-2">
            <p className="font-sans text-sm font-medium text-pearl-text">
              Theme
            </p>
          </div>
          <ThemeSelector
            value={preferences.theme}
            onChange={(theme) => updatePreferences({ theme })}
          />
          <p className="mt-2 font-sans text-xs text-muted-text">
            {preferences.theme === 'system'
              ? 'Follows your operating system dark/light preference.'
              : preferences.theme === 'dark'
              ? 'Dark theme is always applied regardless of system setting.'
              : 'Light theme is always applied regardless of system setting.'}
          </p>
        </div>

        <div className="border-t border-tactical-border/60" aria-hidden="true" />

        {/* ── Reduced Motion ─────────────────────────────────────────────── */}
        <ToggleRow
          label="Reduced Motion"
          description="Disable animations, transitions, and motion effects across the entire app. Improves performance on lower-end devices."
          checked={preferences.reduced_motion}
          onChange={(val) => updatePreferences({ reduced_motion: val })}
          Icon={Zap}
          iconClass={preferences.reduced_motion ? 'text-muted-emerald' : 'text-muted-text'}
        />

        <div className="border-t border-tactical-border/60" aria-hidden="true" />

        {/* ── Privacy Mode ───────────────────────────────────────────────── */}
        <ToggleRow
          label="Privacy Mode"
          description={
            preferences.privacy_mode
              ? 'Active. Financial values on the Dashboard, Wallet, and Analytics are masked as Rp ***.***.  Values here remain visible for editing.'
              : 'When enabled, masks all financial values on Dashboard, Wallet, and Analytics as Rp ***.***.'
          }
          checked={preferences.privacy_mode}
          onChange={(val) => updatePreferences({ privacy_mode: val })}
          Icon={preferences.privacy_mode ? EyeOff : Eye}
          iconClass={preferences.privacy_mode ? 'text-steel-violet' : 'text-muted-text'}
          badge={preferences.privacy_mode ? 'Active' : undefined}
        />
      </div>
    </section>
  )
}

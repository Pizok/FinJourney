// ─── NotificationSettingsCard.tsx ────────────────────────────────────────────
// Card 5: Notifications & Alerts
//
// Toggles:
//   1. Daily Reminder        — evening transaction prompt at 20:00 local time
//   2. Hazard Alerts         — Debt Ambush fires or HP drops critical
//   3. Achievement Notifications — positive events: Level Ups, boss completions
//
// All three wire directly into the Zustand store via updateNotifications().
// The store's isDirty flag propagates to UnsavedChangesBar automatically.
//
// Delivery mechanism is email (see feature.md: "Reminder System → email reminder").
// Future push notification support is planned but not wired here.
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import { useId } from 'react'
import { Bell, ShieldAlert, Trophy } from 'lucide-react'
import {
  useSettingsStore,
  selectCurrentNotifications,
} from '../store/settingsStore'
import { Toggle } from '../shared/Toggle'

// ─── ToggleRow ────────────────────────────────────────────────────────────────
// Local to this card. Consistent with PreferencesCard.ToggleRow but kept
// co-located rather than extracted to a shared file (avoiding premature
// abstraction). Extract to shared/ when a third consumer appears.

interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  Icon: React.ElementType
  /** Colour applied to the icon when the toggle is ON */
  activeIconClass: string
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  Icon,
  activeIconClass,
}: ToggleRowProps) {
  const switchId = useId()
  const descId = useId()

  return (
    <div className="flex items-start justify-between gap-6 py-5">
      {/* Leading icon + label + description */}
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {/* Icon container */}
        <div
          className={[
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            'transition-colors duration-200',
            checked
              ? 'bg-canvas-surface'
              : 'bg-abyssal-slate',
          ].join(' ')}
          aria-hidden="true"
        >
          <Icon
            className={[
              'transition-colors duration-200',
              checked ? activeIconClass : 'text-muted-text/50',
            ].join(' ')}
            size={15}
            strokeWidth={2}
          />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <label
            htmlFor={switchId}
            className="cursor-pointer font-sans text-sm font-medium text-pearl-text"
          >
            {label}
          </label>
          <p
            id={descId}
            className="mt-0.5 font-sans text-xs leading-relaxed text-muted-text"
          >
            {description}
          </p>
        </div>
      </div>

      {/* Toggle */}
      <div className="mt-0.5 shrink-0">
        <Toggle
          id={switchId}
          checked={checked}
          onChange={onChange}
          aria-describedby={descId}
        />
      </div>
    </div>
  )
}

// ─── Row configuration ────────────────────────────────────────────────────────
// Centralising copy here makes it easy to audit labels and descriptions without
// hunting through JSX.

type NotificationKey = 'daily_reminder' | 'hazard_alerts' | 'achievement_notifications'

interface NotificationRowConfig {
  key: NotificationKey
  label: string
  description: string
  Icon: React.ElementType
  activeIconClass: string
}

const NOTIFICATION_ROWS: NotificationRowConfig[] = [
  {
    key: 'daily_reminder',
    label: 'Daily Reminder',
    description:
      'Sends an email at 20:00 in your local timezone if no transaction has been logged that day. Prevents the Ghost Penalty from accumulating.',
    Icon: Bell,
    activeIconClass: 'text-muted-emerald',
  },
  {
    key: 'hazard_alerts',
    label: 'Hazard Alerts',
    description:
      'Immediate email alert when a Debt Ambush event fires or your HP drops to a critical threshold. Time-sensitive — recommended to keep on.',
    Icon: ShieldAlert,
    activeIconClass: 'text-terracotta',
  },
  {
    key: 'achievement_notifications',
    label: 'Achievement Notifications',
    description:
      'Email digest for positive milestones: Level Ups, quarterly boss completions, region stamps, and new theme unlocks.',
    Icon: Trophy,
    activeIconClass: 'text-dawn-gold',
  },
]

// ─── NotificationSettingsCard ─────────────────────────────────────────────────

export function NotificationSettingsCard() {
  const notifications = useSettingsStore(selectCurrentNotifications)
  const updateNotifications = useSettingsStore((s) => s.updateNotifications)
  // Read email reactively so it updates if the Profile card changes it
  const email = useSettingsStore((s) => s.currentSettings.profile.email)

  return (
    <section
      id="notifications"
      aria-labelledby="notifications-heading"
      className="rounded-xl border border-tactical-border bg-canvas-surface scroll-mt-8"
    >
      {/* Card Header */}
      <div className="border-b border-tactical-border px-8 py-6">
        <h2
          id="notifications-heading"
          className="font-display text-base font-semibold text-pearl-text"
        >
          Notifications & Alerts
        </h2>
        <p className="mt-0.5 font-sans text-sm text-muted-text">
          Control when FinJourney reaches out. Delivered via email to your
          connected address.
        </p>
      </div>

      {/* Card Body — toggle list */}
      <div className="px-8">
        {NOTIFICATION_ROWS.map((row, index) => {
          const isLast = index === NOTIFICATION_ROWS.length - 1

          return (
            <div key={row.key}>
              <ToggleRow
                label={row.label}
                description={row.description}
                checked={notifications[row.key]}
                onChange={(val) => updateNotifications({ [row.key]: val })}
                Icon={row.Icon}
                activeIconClass={row.activeIconClass}
              />
              {!isLast && (
                <div
                  className="border-t border-tactical-border/60"
                  aria-hidden="true"
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Footer note */}
      <div className="border-t border-tactical-border bg-abyssal-slate/30 px-8 py-4 rounded-b-xl">
        <p className="font-sans text-xs leading-relaxed text-muted-text">
          Notifications are sent to{' '}
          <span className="text-pearl-text">{email}</span>
          . To change your email address, update it through your auth provider.
        </p>
      </div>
    </section>
  )
}

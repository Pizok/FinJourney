// ─── ProfileCard.tsx ──────────────────────────────────────────────────────────
// Card 1: Profile & Account
//
// Controls:
//   • AvatarUploader  — image preview + upload trigger (UI only — see note below)
//   • UsernameInput   — editable text, bound to store
//   • EmailDisplay    — read-only, managed by auth provider
//   • TimezoneSelector — dropdown; locked for 30 days after a change
//   • PaydaySelector  — dropdown 1–31
//
// PATCH /api/v1/settings/profile
//   Request: { username, timezone, primary_payday }
//   NOTE: avatar_url is NOT part of this PATCH contract (settings_data_contract.md).
//   Avatar upload likely requires a separate multipart endpoint not yet defined.
//   AvatarUploader below is wired to local preview state only — backend wiring
//   is a follow-up once that endpoint exists.
//
// Timezone Hopping Protection (settings_prd.md §4.2):
//   timezone_locked_until (ISO string | null) comes from GET /api/v1/settings.
//   If set and in the future, the selector is locked for the remaining duration.
//   Attempting to interact with a locked selector surfaces a toast explaining
//   the 30-day cooldown — handled locally via an invisible overlay button so the
//   native <select> itself stays disabled (prevents keyboard users from opening
//   a dropdown they can't commit to).
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import { useId, useRef, useState } from 'react'
import { Camera, ChevronDown, Lock, Mail } from 'lucide-react'
import { toast } from 'sonner'
import {
  useSettingsStore,
  selectCurrentProfile,
} from '../store/settingsStore'

// ─── Timezone Catalog ─────────────────────────────────────────────────────────
// Curated list rather than the full IANA database (400+ entries would be
// unusable in a plain <select>). Covers the regions referenced in logic.md
// plus common adjacent zones for the target user base (students/young
// professionals in Indonesia and nearby).

interface TimezoneOption {
  value: string
  label: string
}

const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: 'Asia/Jakarta', label: 'Jakarta (WIB, UTC+7)' },
  { value: 'Asia/Makassar', label: 'Makassar (WITA, UTC+8)' },
  { value: 'Asia/Jayapura', label: 'Jayapura (WIT, UTC+9)' },
  { value: 'Asia/Singapore', label: 'Singapore (UTC+8)' },
  { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur (UTC+8)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (UTC+7)' },
  { value: 'Asia/Manila', label: 'Manila (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
  { value: 'Asia/Seoul', label: 'Seoul (UTC+9)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (UTC+8)' },
  { value: 'Asia/Dubai', label: 'Dubai (UTC+4)' },
  { value: 'Europe/London', label: 'London (UTC+0/+1)' },
  { value: 'Europe/Paris', label: 'Paris (UTC+1/+2)' },
  { value: 'America/New_York', label: 'New York (UTC-5/-4)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (UTC-8/-7)' },
  { value: 'Australia/Sydney', label: 'Sydney (UTC+10/+11)' },
  { value: 'UTC', label: 'UTC' },
]

// ─── Payday Options ───────────────────────────────────────────────────────────

const PAYDAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1)

function ordinalSuffix(day: number): string {
  if (day % 10 === 1 && day !== 11) return 'st'
  if (day % 10 === 2 && day !== 12) return 'nd'
  if (day % 10 === 3 && day !== 13) return 'rd'
  return 'th'
}

// ─── FieldLabel ───────────────────────────────────────────────────────────────
// Shared label + helper text pattern used by every control in this card.

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block font-sans text-xs font-medium text-muted-text"
    >
      {children}
    </label>
  )
}

function HelperText({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 font-sans text-xs leading-relaxed text-muted-text">
      {children}
    </p>
  )
}

// ─── AvatarUploader ───────────────────────────────────────────────────────────

function AvatarUploader({ avatarUrl }: { avatarUrl: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB.')
      return
    }

    // Local preview only — actual upload endpoint TBD.
    const reader = new FileReader()
    reader.onload = () => setPreviewUrl(reader.result as string)
    reader.readAsDataURL(file)

    // TODO: once an avatar upload endpoint exists, POST the file here and
    // call updateProfile({ avatar_url: <returned url> }) on success.
    toast.info('Avatar preview updated. Upload syncing is not yet connected.')
  }

  const displaySrc = previewUrl ?? avatarUrl

  return (
    <div className="flex items-center gap-4">
      {/* Avatar preview */}
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-tactical-border bg-abyssal-slate">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displaySrc}
          alt="Profile avatar"
          className="h-full w-full object-cover"
          onError={(e) => {
            // Graceful fallback if avatar_url 404s
            ;(e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      </div>

      {/* Upload trigger */}
      <div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={[
            'flex items-center gap-2 rounded-lg border border-tactical-border px-3 py-2',
            'font-sans text-sm font-medium text-pearl-text',
            'transition-colors duration-150',
            'hover:border-pearl-text/30 hover:bg-pearl-text/5',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-emerald',
            'focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface',
          ].join(' ')}
        >
          <Camera size={14} strokeWidth={2} aria-hidden="true" />
          Change Avatar
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Upload new avatar image"
        />
        <p className="mt-1.5 font-sans text-xs text-muted-text">
          PNG, JPG, or WebP. Max 5MB.
        </p>
      </div>
    </div>
  )
}

// ─── UsernameInput ────────────────────────────────────────────────────────────

function UsernameInput({
  value,
  onChange,
}: {
  value: string
  onChange: (val: string) => void
}) {
  const id = useId()

  return (
    <div>
      <FieldLabel htmlFor={id}>Username</FieldLabel>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={32}
        spellCheck={false}
        autoComplete="off"
        className={[
          'w-full rounded-lg border border-tactical-border bg-abyssal-slate px-3 py-2.5',
          'font-sans text-sm text-pearl-text',
          'transition-colors duration-150',
          'focus:outline-none focus:border-muted-emerald/60',
          'focus:ring-1 focus:ring-muted-emerald/30',
        ].join(' ')}
      />
      <HelperText>
        Displayed on your Player ID card and dashboard. Visible to no one but
        you unless you share it.
      </HelperText>
    </div>
  )
}

// ─── EmailDisplay ─────────────────────────────────────────────────────────────

function EmailDisplay({ email }: { email: string }) {
  const id = useId()

  return (
    <div>
      <FieldLabel htmlFor={id}>Connected Email</FieldLabel>
      <div
        id={id}
        className={[
          'flex items-center gap-2.5 rounded-lg border border-tactical-border',
          'bg-abyssal-slate/60 px-3 py-2.5',
        ].join(' ')}
      >
        <Mail
          className="shrink-0 text-muted-text/60"
          size={14}
          strokeWidth={2}
          aria-hidden="true"
        />
        <span className="truncate font-sans text-sm text-muted-text">
          {email}
        </span>
      </div>
      <HelperText>
        Managed via your authentication provider. Change it through your
        account login settings.
      </HelperText>
    </div>
  )
}

// ─── TimezoneSelector ─────────────────────────────────────────────────────────

interface TimezoneSelectorProps {
  value: string
  lockedUntil: string | null
  onChange: (tz: string) => void
}

function TimezoneSelector({ value, lockedUntil, onChange }: TimezoneSelectorProps) {
  const id = useId()

  const lockedUntilDate = lockedUntil ? new Date(lockedUntil) : null
  const now = new Date()
  const isLocked = !!lockedUntilDate && lockedUntilDate > now

  const daysRemaining = isLocked
    ? Math.max(
        1,
        Math.ceil((lockedUntilDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      )
    : 0

  const formattedUnlockDate = lockedUntilDate
    ? lockedUntilDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  function handleLockedAttempt() {
    toast.error('Timezone can only be changed once every 30 days.')
  }

  return (
    <div>
      <FieldLabel htmlFor={id}>Timezone</FieldLabel>

      {/*
        Relative wrapper: when locked, an invisible full-cover button sits on
        top of the disabled <select>. This lets us surface a toast on
        interaction attempts while the native control remains genuinely
        disabled (no focus, no dropdown, no native validation quirks).
      */}
      <div className="relative">
        <div className="relative">
          <select
            id={id}
            value={value}
            disabled={isLocked}
            onChange={(e) => onChange(e.target.value)}
            className={[
              'w-full appearance-none rounded-lg border bg-abyssal-slate px-3 py-2.5 pr-9',
              'font-sans text-sm',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-1',
              isLocked
                ? 'border-tactical-border/60 text-muted-text/50 cursor-not-allowed'
                : 'border-tactical-border text-pearl-text focus:border-muted-emerald/60 focus:ring-muted-emerald/30',
            ].join(' ')}
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>

          {/* Chevron / Lock icon */}
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            {isLocked ? (
              <Lock
                className="text-muted-text/40"
                size={14}
                strokeWidth={2}
                aria-hidden="true"
              />
            ) : (
              <ChevronDown
                className="text-muted-text/60"
                size={14}
                strokeWidth={2}
                aria-hidden="true"
              />
            )}
          </div>
        </div>

        {/* Interaction-capture overlay — only present while locked */}
        {isLocked && (
          <button
            type="button"
            onClick={handleLockedAttempt}
            className="absolute inset-0 cursor-not-allowed rounded-lg"
            aria-label={`Timezone locked. Unlocks ${formattedUnlockDate}.`}
          />
        )}
      </div>

      {isLocked ? (
        <HelperText>
          <span className="inline-flex items-center gap-1.5 text-dawn-gold">
            <Lock size={11} strokeWidth={2} aria-hidden="true" />
            Locked for {daysRemaining} more day{daysRemaining !== 1 ? 's' : ''}
          </span>
          {' — '}unlocks {formattedUnlockDate}. This prevents shifting your
          midnight reset to avoid Ghost Penalties.
        </HelperText>
      ) : (
        <HelperText>
          Critical for the midnight game-state reset and evening reminder
          timing. Changing this starts a 30-day lock.
        </HelperText>
      )}
    </div>
  )
}

// ─── PaydaySelector ───────────────────────────────────────────────────────────

function PaydaySelector({
  value,
  onChange,
}: {
  value: number
  onChange: (day: number) => void
}) {
  const id = useId()

  return (
    <div>
      <FieldLabel htmlFor={id}>Primary Payday</FieldLabel>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={[
            'w-full appearance-none rounded-lg border border-tactical-border bg-abyssal-slate px-3 py-2.5 pr-9',
            'font-sans text-sm text-pearl-text',
            'transition-colors duration-150',
            'focus:outline-none focus:border-muted-emerald/60',
            'focus:ring-1 focus:ring-muted-emerald/30',
          ].join(' ')}
        >
          {PAYDAY_OPTIONS.map((day) => (
            <option key={day} value={day}>
              {day}
              {ordinalSuffix(day)} of the month
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-text/60"
          size={14}
          strokeWidth={2}
          aria-hidden="true"
        />
      </div>
      <HelperText>Used for monthly planning and budget projections.</HelperText>
    </div>
  )
}

// ─── ProfileCard ──────────────────────────────────────────────────────────────

export function ProfileCard() {
  const profile = useSettingsStore(selectCurrentProfile)
  const updateProfile = useSettingsStore((s) => s.updateProfile)

  return (
    <section
      id="profile"
      aria-labelledby="profile-heading"
      className="rounded-xl border border-tactical-border bg-canvas-surface scroll-mt-8"
    >
      {/* Card Header */}
      <div className="border-b border-tactical-border px-8 py-6">
        <h2
          id="profile-heading"
          className="font-display text-base font-semibold text-pearl-text"
        >
          Profile & Account
        </h2>
        <p className="mt-0.5 font-sans text-sm text-muted-text">
          Your identity, timezone, and system defaults.
        </p>
      </div>

      {/* Card Body */}
      <div className="flex flex-col gap-6 px-8 py-6">
        {/* Avatar — full width row */}
        <AvatarUploader avatarUrl={profile.avatar_url} />

        <div className="border-t border-tactical-border/60" aria-hidden="true" />

        {/* Username + Email — two columns on desktop */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <UsernameInput
            value={profile.username}
            onChange={(username) => updateProfile({ username })}
          />
          <EmailDisplay email={profile.email} />
        </div>

        {/* Timezone + Payday — two columns on desktop */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <TimezoneSelector
            value={profile.timezone}
            lockedUntil={profile.timezone_locked_until}
            onChange={(timezone) => updateProfile({ timezone })}
          />
          <PaydaySelector
            value={profile.primary_payday}
            onChange={(primary_payday) => updateProfile({ primary_payday })}
          />
        </div>
      </div>
    </section>
  )
}

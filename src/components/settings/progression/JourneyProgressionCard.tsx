// ─── JourneyProgressionCard.tsx ──────────────────────────────────────────────
// Card 3: Journey & Progression
//
// Sections:
//   1. Active Path — current class with icon, tagline, and passive bonuses
//   2. Cooldown — remaining lock period with visual progress bar
//   3. Change Path — opens ChangePathModal (disabled during cooldown)
//   4. Danger Zone — Reset Game Progress (terracotta, requires ResetProgressModal)
//
// Sub-components (co-located):
//   • ActivePathDisplay
//   • CooldownIndicator
//   • ChangePathModal
//   • ResetProgressModal
//
// Immediate mutations (POST, not batched with the global Save flow):
//   • POST /api/v1/settings/path/change
//   • POST /api/v1/settings/reset-progress
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import { useState, useId, useRef, useEffect } from 'react'
import {
  Shield,
  EyeOff,
  TrendingUp,
  Check,
  AlertTriangle,
  X,
  Loader2,
  ChevronRight,
  Lock,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useSettingsStore,
  selectCurrentProgression,
} from '../store/settingsStore'
import { apiFetchClient } from '@/lib/apiClient.client'
import type { PathId, ActivePath } from '../types/settings.types'

// ─── Path Catalog ─────────────────────────────────────────────────────────────
// Defines static metadata for each path. Descriptions and bonuses are product
// copy that does not live in the API payload (the payload only returns the
// active path's id, name, and description). The full catalogue is needed to
// render all three options in ChangePathModal.

interface PathMeta {
  id: PathId
  name: string
  tagline: string
  description: string
  bonuses: string[]
  /** Lucide icon component */
  Icon: React.ElementType
  /** Tailwind class: icon container bg colour */
  iconBg: string
  /** Tailwind class: icon colour */
  iconColor: string
  /** Tailwind class: active card border accent */
  borderAccent: string
}

const PATH_CATALOG: Record<PathId, PathMeta> = {
  sentinel: {
    id: 'sentinel',
    name: 'Sentinel',
    tagline: 'Defensive mastery',
    description:
      'Fortify your position. Reward cautious, consistent saving and maximise shield recovery on every surplus day.',
    bonuses: [
      '+ Shield effectiveness on daily surplus',
      '+ Emergency fund deposit rewards',
      '+ Bonus HP recovery on zero-spend days',
    ],
    Icon: Shield,
    iconBg: 'bg-muted-emerald/10',
    iconColor: 'text-muted-emerald',
    borderAccent: 'border-muted-emerald/40',
  },
  phantom: {
    id: 'phantom',
    name: 'Phantom',
    tagline: 'Invisible discipline',
    description:
      'Operate beneath the surface. XP multipliers for stealth spending and sustained no-spend streaks compound over time.',
    bonuses: [
      '+ XP multiplier on no-spend days',
      '+ Extended streak bonuses',
      '+ Reduced ghost penalty window',
    ],
    Icon: EyeOff,
    iconBg: 'bg-steel-violet/10',
    iconColor: 'text-steel-violet',
    borderAccent: 'border-steel-violet/40',
  },
  vanguard: {
    id: 'vanguard',
    name: 'Vanguard',
    tagline: 'Aggressive growth',
    description:
      'Push the frontier. Higher XP rewards for income growth and above-target savings performance accelerate your region progression.',
    bonuses: [
      '+ XP bonus on income growth',
      '+ Elevated savings milestone rewards',
      '+ Faster quarterly boss progression',
    ],
    Icon: TrendingUp,
    iconBg: 'bg-dawn-gold/10',
    iconColor: 'text-dawn-gold',
    borderAccent: 'border-dawn-gold/40',
  },
}

// Total cooldown duration assumed from PRD ("6-month cooldown").
const COOLDOWN_TOTAL_DAYS = 180

// ─── ActivePathDisplay ────────────────────────────────────────────────────────

function ActivePathDisplay({ path }: { path: ActivePath }) {
  const meta = PATH_CATALOG[path.id]
  const { Icon, iconBg, iconColor, borderAccent } = meta

  return (
    <div
      className={[
        'rounded-lg border bg-abyssal-slate p-5',
        borderAccent,
      ].join(' ')}
    >
      {/* Path identity row */}
      <div className="flex items-start gap-4">
        <div
          className={[
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            iconBg,
          ].join(' ')}
          aria-hidden="true"
        >
          <Icon className={iconColor} size={18} strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-semibold text-pearl-text">
              {path.name}
            </h3>
            <span
              className={[
                'rounded px-1.5 py-0.5 font-sans text-[10px] font-semibold',
                'uppercase tracking-wider',
                iconColor,
                iconBg,
              ].join(' ')}
            >
              Active
            </span>
          </div>
          <p className="mt-0.5 font-sans text-xs text-muted-text">
            {meta.tagline}
          </p>
        </div>
      </div>

      {/* Passive bonuses */}
      <div className="mt-4 border-t border-tactical-border pt-4">
        <p className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-wider text-muted-text">
          Passive Bonuses
        </p>
        <ul className="flex flex-col gap-1.5" aria-label="Active path bonuses">
          {meta.bonuses.map((bonus) => (
            <li key={bonus} className="flex items-start gap-2">
              <Check
                className="mt-0.5 shrink-0 text-muted-emerald"
                size={12}
                strokeWidth={2.5}
                aria-hidden="true"
              />
              <span className="font-sans text-xs text-muted-text">{bonus}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─── CooldownIndicator ────────────────────────────────────────────────────────

function CooldownIndicator({
  daysRemaining,
}: {
  daysRemaining: number
}) {
  const progressPercent = Math.max(
    0,
    Math.min(
      100,
      ((COOLDOWN_TOTAL_DAYS - daysRemaining) / COOLDOWN_TOTAL_DAYS) * 100,
    ),
  )

  return (
    <div
      className="rounded-lg border border-tactical-border bg-abyssal-slate px-4 py-3"
      aria-label={`Cooldown: ${daysRemaining} days remaining`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Lock
            className="text-muted-text/60"
            size={12}
            strokeWidth={2}
            aria-hidden="true"
          />
          <span className="font-sans text-xs font-medium text-muted-text">
            Next Path Change
          </span>
        </div>
        <span className="font-sans text-xs tabular-nums text-pearl-text">
          {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
        </span>
      </div>

      {/* Progress track */}
      <div
        className="h-1 overflow-hidden rounded-full bg-tactical-border/60"
        role="progressbar"
        aria-valuenow={Math.round(progressPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${Math.round(progressPercent)}% of cooldown elapsed`}
      >
        <div
          className="h-full rounded-full bg-muted-emerald/40 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <p className="mt-2 font-sans text-[11px] text-muted-text/70">
        {COOLDOWN_TOTAL_DAYS - daysRemaining} of {COOLDOWN_TOTAL_DAYS} days elapsed
      </p>
    </div>
  )
}

// ─── ChangePathModal ──────────────────────────────────────────────────────────

interface ChangePathModalProps {
  currentPathId: PathId
  onClose: () => void
  onSuccess: (newPath: Pick<ActivePath, 'id' | 'name'>, cooldownDays: number) => void
}

function ChangePathModal({
  currentPathId,
  onClose,
  onSuccess,
}: ChangePathModalProps) {
  const [selectedId, setSelectedId] = useState<PathId | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const titleId = useId()
  const firstFocusRef = useRef<HTMLButtonElement>(null)

  // Trap focus on mount
  useEffect(() => {
    firstFocusRef.current?.focus()
  }, [])

  // Escape to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleConfirm() {
    if (!selectedId || isSubmitting) return
    setIsSubmitting(true)
    setApiError(null)

    try {
      const data: any = await apiFetchClient('settings/path/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_path: selectedId }),
      })

      // Notify parent; parent invalidates ['settings'] query and closes modal
      onSuccess(data.active_path, data.cooldown_days)
    } catch (err: any) {
      setApiError(err?.message || 'Path change failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const allPaths = Object.values(PATH_CATALOG)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-abyssal-slate/80"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={[
          'fixed left-1/2 top-1/2 z-50 w-full max-w-lg',
          '-translate-x-1/2 -translate-y-1/2',
          'rounded-xl border border-tactical-border bg-canvas-surface',
          'animate-fade-in',
          // Allow vertical scrolling on small viewports
          'max-h-[90vh] overflow-y-auto',
        ].join(' ')}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-tactical-border bg-canvas-surface px-6 py-5">
          <h3
            id={titleId}
            className="font-display text-base font-semibold text-pearl-text"
          >
            Select Your Path
          </h3>
          <button
            ref={firstFocusRef}
            type="button"
            onClick={onClose}
            className={[
              'rounded-md p-1 text-muted-text',
              'transition-colors hover:bg-tactical-border/40 hover:text-pearl-text',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-emerald',
            ].join(' ')}
            aria-label="Close path selection"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Warning banner */}
        <div className="border-b border-tactical-border bg-dawn-gold/5 px-6 py-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className="mt-0.5 shrink-0 text-dawn-gold"
              size={14}
              strokeWidth={2}
              aria-hidden="true"
            />
            <p className="font-sans text-xs leading-relaxed text-muted-text">
              Changing your path initiates a{' '}
              <span className="font-medium text-pearl-text">
                {COOLDOWN_TOTAL_DAYS}-day cooldown
              </span>
              . You cannot change it again during this period.
            </p>
          </div>
        </div>

        {/* Path options */}
        <div
          className="flex flex-col gap-3 p-6"
          role="radiogroup"
          aria-label="Available paths"
        >
          {allPaths.map((meta) => {
            const isCurrent = meta.id === currentPathId
            const isSelected = selectedId === meta.id
            const { Icon, iconBg, iconColor, borderAccent } = meta

            return (
              <button
                key={meta.id}
                type="button"
                role="radio"
                aria-checked={isCurrent ? true : isSelected}
                disabled={isCurrent}
                onClick={() => !isCurrent && setSelectedId(meta.id)}
                className={[
                  'w-full rounded-lg border p-4 text-left',
                  'transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-emerald focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface',
                  isCurrent
                    ? [borderAccent, 'bg-abyssal-slate cursor-default opacity-70'].join(' ')
                    : isSelected
                    ? [borderAccent, 'bg-abyssal-slate'].join(' ')
                    : 'border-tactical-border bg-abyssal-slate/40 hover:border-tactical-border/80 hover:bg-abyssal-slate cursor-pointer',
                ].join(' ')}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={[
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      iconBg,
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    <Icon className={iconColor} size={15} strokeWidth={2} />
                  </div>

                  {/* Text content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-semibold text-pearl-text">
                        {meta.name}
                      </span>
                      <span className="font-sans text-xs text-muted-text">
                        {meta.tagline}
                      </span>
                      {isCurrent && (
                        <span
                          className={[
                            'ml-auto rounded px-1.5 py-0.5 font-sans text-[10px]',
                            'font-semibold uppercase tracking-wider',
                            iconColor,
                            iconBg,
                          ].join(' ')}
                        >
                          Current
                        </span>
                      )}
                    </div>

                    <p className="mt-1 font-sans text-xs leading-relaxed text-muted-text">
                      {meta.description}
                    </p>

                    {/* Bonuses */}
                    <ul className="mt-2 flex flex-col gap-1" aria-label={`${meta.name} bonuses`}>
                      {meta.bonuses.map((bonus) => (
                        <li key={bonus} className="flex items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            className={['h-1 w-1 shrink-0 rounded-full', iconColor].join(' ')}
                          />
                          <span className="font-sans text-[11px] text-muted-text">
                            {bonus}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Selection indicator */}
                  {!isCurrent && (
                    <div
                      aria-hidden="true"
                      className={[
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                        isSelected
                          ? 'border-muted-emerald bg-muted-emerald'
                          : 'border-tactical-border',
                      ].join(' ')}
                    >
                      {isSelected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* API error */}
        {apiError && (
          <div className="mx-6 -mt-1 mb-4 flex items-start gap-2 rounded-lg border border-terracotta/30 bg-terracotta/5 px-3 py-2.5">
            <AlertTriangle
              className="mt-0.5 shrink-0 text-terracotta"
              size={13}
              strokeWidth={2}
              aria-hidden="true"
            />
            <p className="font-sans text-xs text-terracotta">{apiError}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-tactical-border px-6 py-5">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedId || isSubmitting}
            className={[
              'flex w-full items-center justify-center gap-2 rounded-lg py-2.5',
              'bg-muted-emerald font-sans text-sm font-medium text-white',
              'transition-colors duration-150 hover:bg-muted-emerald/90',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-emerald',
              'focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface',
              'disabled:cursor-not-allowed disabled:opacity-50',
            ].join(' ')}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={14} strokeWidth={2} />
                <span>Confirming…</span>
              </>
            ) : (
              <>
                <ChevronRight size={14} strokeWidth={2.5} aria-hidden="true" />
                <span>Confirm Path Change</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── ResetProgressModal ───────────────────────────────────────────────────────

interface ResetProgressModalProps {
  onClose: () => void
  onSuccess: () => void
}

const RESET_KEYWORD = 'RESET'

function ResetProgressModal({ onClose, onSuccess }: ResetProgressModalProps) {
  const [inputValue, setInputValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const titleId = useId()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const isConfirmed = inputValue === RESET_KEYWORD

  useEffect(() => {
    // Short delay so focus doesn't steal from the backdrop transition
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleReset() {
    if (!isConfirmed || isSubmitting) return
    setIsSubmitting(true)
    setApiError(null)

    try {
      await apiFetchClient('settings/reset-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: RESET_KEYWORD }),
      })

      onSuccess()
    } catch (err: any) {
      setApiError(err?.message || 'Reset failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-abyssal-slate/80"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={[
          'fixed left-1/2 top-1/2 z-50 w-full max-w-md',
          '-translate-x-1/2 -translate-y-1/2',
          'rounded-xl border border-tactical-border bg-canvas-surface',
          'animate-fade-in',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-tactical-border px-6 py-5">
          <h3
            id={titleId}
            className="font-display text-base font-semibold text-terracotta"
          >
            Reset Journey Progress?
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={[
              'rounded-md p-1 text-muted-text',
              'transition-colors hover:bg-tactical-border/40 hover:text-pearl-text',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-emerald',
            ].join(' ')}
            aria-label="Close reset dialog"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* What resets */}
          <p className="font-sans text-sm leading-relaxed text-muted-text">
            This will reset your{' '}
            <span className="font-medium text-pearl-text">Level to 1</span>,{' '}
            <span className="font-medium text-pearl-text">XP to 0</span>, and{' '}
            <span className="font-medium text-pearl-text">HP to 100</span>. Your
            region progress will restart.
          </p>

          {/* What does NOT reset */}
          <div className="mt-3 rounded-lg border border-tactical-border bg-abyssal-slate px-4 py-3">
            <p className="font-sans text-xs leading-relaxed text-muted-text">
              <span className="font-semibold text-pearl-text">
                Financial data is never deleted.
              </span>{' '}
              Your wallets, transactions, loans, and categories remain exactly as
              they are.
            </p>
          </div>

          {/* Typed confirmation */}
          <div className="mt-5">
            <label
              htmlFor={inputId}
              className="mb-1.5 block font-sans text-xs font-medium text-muted-text"
            >
              Type{' '}
              <span className="font-mono font-semibold text-terracotta">
                {RESET_KEYWORD}
              </span>{' '}
              to confirm
            </label>
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value.toUpperCase())
                setApiError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isConfirmed) handleReset()
              }}
              spellCheck={false}
              autoComplete="off"
              placeholder="Type RESET"
              className={[
                'w-full rounded-lg border bg-abyssal-slate px-3 py-2.5',
                'font-mono text-sm tracking-widest',
                'transition-colors duration-150',
                'placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-text/40',
                'focus:outline-none focus:ring-0',
                isConfirmed
                  ? 'border-terracotta/60 text-terracotta'
                  : 'border-tactical-border text-pearl-text focus:border-terracotta/40',
              ].join(' ')}
              aria-describedby={apiError ? `${inputId}-error` : undefined}
            />
          </div>

          {/* API error */}
          {apiError && (
            <p
              id={`${inputId}-error`}
              role="alert"
              className="mt-2 font-sans text-xs text-terracotta"
            >
              {apiError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-tactical-border px-6 py-5">
          {/* Cancel */}
          <button
            type="button"
            onClick={onClose}
            className={[
              'flex-1 rounded-lg border border-tactical-border py-2.5',
              'font-sans text-sm font-medium text-pearl-text',
              'transition-colors duration-150',
              'hover:border-pearl-text/30 hover:bg-pearl-text/5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-emerald',
            ].join(' ')}
          >
            Cancel
          </button>

          {/* Confirm Reset */}
          <button
            type="button"
            onClick={handleReset}
            disabled={!isConfirmed || isSubmitting}
            className={[
              'flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5',
              'bg-terracotta font-sans text-sm font-medium text-white',
              'transition-colors duration-150',
              'hover:bg-terracotta/90',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta',
              'focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface',
              'disabled:cursor-not-allowed disabled:opacity-40',
            ].join(' ')}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={14} strokeWidth={2} />
                <span>Resetting…</span>
              </>
            ) : (
              <span>Confirm Reset</span>
            )}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── DangerZone ───────────────────────────────────────────────────────────────
// Design rule: terracotta text and border only — no red background fill.
// The danger is communicated through deliberate colour choice, not aggression.

function DangerZone({ onResetClick }: { onResetClick: () => void }) {
  return (
    <div className="border-t border-tactical-border px-8 py-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="font-sans text-[11px] font-semibold uppercase tracking-widest text-terracotta">
            Danger Zone
          </p>
          <p className="mt-1 font-sans text-xs leading-relaxed text-muted-text">
            Permanently resets Level, XP, HP, and region progress.
            Financial data is not affected.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetClick}
          className={[
            'shrink-0 rounded-lg border border-terracotta/40 px-4 py-2',
            'font-sans text-sm font-medium text-terracotta',
            'transition-colors duration-150',
            'hover:border-terracotta hover:bg-terracotta hover:text-white',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta',
            'focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface',
          ].join(' ')}
          aria-label="Open reset journey progress dialog"
        >
          Reset Game Progress
        </button>
      </div>
    </div>
  )
}

// ─── JourneyProgressionCard ───────────────────────────────────────────────────

export function JourneyProgressionCard() {
  const queryClient = useQueryClient()
  const progression = useSettingsStore(selectCurrentProgression)
  const [isChangePathOpen, setIsChangePathOpen] = useState(false)
  const [isResetOpen, setIsResetOpen] = useState(false)

  const { active_path, cooldown_active, cooldown_days_remaining } = progression

  function handlePathChangeSuccess(
    newPath: Pick<ActivePath, 'id' | 'name'>,
    cooldownDays: number,
  ) {
    // In production: call queryClient.invalidateQueries(['settings'])
    // and close the modal. The store is re-hydrated from the fresh query.
    console.info(
      `[PathChange] Changed to ${newPath.name}. Cooldown: ${cooldownDays} days.`,
    )
    setIsChangePathOpen(false)
    queryClient.invalidateQueries({ queryKey: ['settings'] })
  }

  function handleResetSuccess() {
    // In production: call queryClient.invalidateQueries(['settings'])
    // and redirect the user to the dashboard (progression has restarted).
    console.info('[ResetProgress] Journey reset confirmed.')
    setIsResetOpen(false)
    queryClient.invalidateQueries({ queryKey: ['settings'] })
    window.location.href = '/dashboard'
  }

  return (
    <>
      <section
        id="progression"
        aria-labelledby="progression-heading"
        className="rounded-xl border border-tactical-border bg-canvas-surface scroll-mt-32"
      >
        {/* Card Header */}
        <div className="border-b border-tactical-border px-8 py-6">
          <h2
            id="progression-heading"
            className="font-display text-base font-semibold text-pearl-text"
          >
            Journey & Progression
          </h2>
          <p className="mt-0.5 font-sans text-sm text-muted-text">
            Manage your active path and gamified progression parameters.
          </p>
        </div>

        {/* Card Body */}
        <div className="px-8 py-6">
          {/* Section label */}
          <p className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-widest text-muted-text">
            Active Path
          </p>

          {/* Active path display */}
          <ActivePathDisplay path={active_path} />

          {/* Cooldown indicator + change button */}
          <div className="mt-4 flex flex-col gap-3">
            {cooldown_active && (
              <CooldownIndicator daysRemaining={cooldown_days_remaining} />
            )}

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  if (!cooldown_active) setIsChangePathOpen(true)
                }}
                className={[
                  'flex items-center gap-2 rounded-lg border px-4 py-2.5',
                  'font-sans text-sm font-medium',
                  'transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-emerald',
                  'focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface',
                  cooldown_active
                    ? 'cursor-not-allowed border-tactical-border/40 text-muted-text/40'
                    : 'border-tactical-border text-pearl-text hover:border-pearl-text/40 hover:bg-pearl-text/5',
                ].join(' ')}
                aria-disabled={cooldown_active}
                title={
                  cooldown_active
                    ? `Path locked for ${cooldown_days_remaining} more days`
                    : 'Select a new path'
                }
              >
                {cooldown_active && (
                  <Lock
                    className="text-muted-text/40"
                    size={13}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                )}
                <span>Change Path</span>
              </button>

              {cooldown_active && (
                <p className="font-sans text-sm text-terracotta/90 font-medium">
                  On Cooldown: {cooldown_days_remaining} days remaining
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Danger Zone — visually separated from body content */}
        <DangerZone onResetClick={() => setIsResetOpen(true)} />
      </section>

      {/* Modals */}
      {isChangePathOpen && !cooldown_active && (
        <ChangePathModal
          currentPathId={active_path.id}
          onClose={() => setIsChangePathOpen(false)}
          onSuccess={handlePathChangeSuccess}
        />
      )}

      {isResetOpen && (
        <ResetProgressModal
          onClose={() => setIsResetOpen(false)}
          onSuccess={handleResetSuccess}
        />
      )}
    </>
  )
}

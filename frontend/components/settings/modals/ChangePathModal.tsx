// ─── ChangePathModal.tsx ──────────────────────────────────────────────────────
// Standalone path-selection dialog.
//
// Rendered by JourneyProgressionCard when the Change Path button is clicked
// and no cooldown is active. (The card's cooldown guard prevents opening this
// modal at all during a locked period — this modal itself does not re-validate.)
//
// Flow (settings_state_flow.md → Path Change Flow):
//   Open → Select path option → Confirm → POST /api/v1/settings/path/change
//   → onSuccess(newPath, cooldownDays) → parent invalidates ['settings'] query
//
// API:
//   POST /api/v1/settings/path/change
//   Body: { path_id: PathId }
//   Response: { success, active_path: { id, name }, cooldown_days }
//
// Usage:
//   <ChangePathModal
//     currentPathId={active_path.id}
//     onClose={() => setOpen(false)}
//     onSuccess={(newPath, cooldownDays) => { invalidate(); close() }}
//   />
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import { useState } from 'react'
import { AlertTriangle, Check, ChevronRight, Loader2 } from 'lucide-react'
import { Modal } from '../../ui/Modal'
import { PATH_LIST, COOLDOWN_TOTAL_DAYS } from '../progression/pathCatalog'
import type { PathId, ActivePath, PathChangeResponse } from '../types/settings.types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChangePathModalProps {
  /** The id of the currently active path. Displayed with a "Current" badge, non-selectable. */
  currentPathId: PathId
  /** Called when the dialog is dismissed without committing. */
  onClose: () => void
  /**
   * Called after a successful POST. Parent is responsible for:
   *   1. Invalidating the ['settings'] TanStack Query key to refresh bootstrap state.
   *   2. Closing the modal via onClose().
   */
  onSuccess: (
    newPath: Pick<ActivePath, 'id' | 'name'>,
    cooldownDays: number,
  ) => void
}

// ─── WarningBanner ────────────────────────────────────────────────────────────
// Persistent sub-header beneath the modal title — always visible before
// the user commits. Uses dawn-gold (warning) not terracotta (danger) because
// this is a consequential-but-recoverable choice, not a destructive action.

function WarningBanner() {
  return (
    <div className="border-b border-tactical-border bg-dawn-gold/5 px-6 py-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle
          className="mt-0.5 shrink-0 text-dawn-gold"
          size={13}
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
  )
}

// ─── PathOption ───────────────────────────────────────────────────────────────
// A single selectable card inside the radiogroup. Current path is shown with
// a "Current" badge and is rendered as non-interactive (disabled button).

interface PathOptionProps {
  meta: (typeof PATH_LIST)[number]
  isCurrent: boolean
  isSelected: boolean
  onSelect: () => void
}

function PathOption({ meta, isCurrent, isSelected, onSelect }: PathOptionProps) {
  const { Icon, iconBg, iconColor, borderAccent } = meta

  // Active state: selected OR current gets the coloured border.
  // Current path uses reduced opacity to signal it is non-interactive.
  const borderClass = isCurrent || isSelected ? borderAccent : 'border-tactical-border'

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isCurrent ? true : isSelected}
      disabled={isCurrent}
      onClick={onSelect}
      className={[
        'w-full rounded-lg border p-4 text-left',
        borderClass,
        'bg-abyssal-slate',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-muted-emerald focus-visible:ring-offset-2',
        'focus-visible:ring-offset-canvas-surface',
        isCurrent
          ? 'cursor-default opacity-60'
          : 'cursor-pointer hover:border-tactical-border/80',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-start gap-3">
        {/* Path icon */}
        <div
          className={[
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            iconBg,
          ].join(' ')}
          aria-hidden="true"
        >
          <Icon className={iconColor} size={15} strokeWidth={2} />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-display text-sm font-semibold text-pearl-text">
              {meta.name}
            </span>
            <span className="font-sans text-xs text-muted-text">
              {meta.tagline}
            </span>

            {isCurrent && (
              <span
                className={[
                  'ml-auto rounded px-1.5 py-0.5',
                  'font-sans text-[10px] font-semibold uppercase tracking-wider',
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

          {/* Bonus list */}
          <ul
            className="mt-2 flex flex-col gap-1"
            aria-label={`${meta.name} passive bonuses`}
          >
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

        {/* Radio indicator — hidden for current path (badge takes its place) */}
        {!isCurrent && (
          <div
            aria-hidden="true"
            className={[
              'mt-1 flex h-4 w-4 shrink-0 items-center justify-center',
              'rounded-full border transition-colors duration-150',
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
}

// ─── ChangePathModal ──────────────────────────────────────────────────────────

export function ChangePathModal({
  currentPathId,
  onClose,
  onSuccess,
}: ChangePathModalProps) {
  const [selectedId, setSelectedId] = useState<PathId | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const canConfirm = selectedId !== null && !isSubmitting

  // ── Mutation ────────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!canConfirm) return
    setIsSubmitting(true)
    setApiError(null)

    try {
      const res = await fetch('/api/v1/settings/path/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path_id: selectedId }),
      })

      const json = (await res.json()) as PathChangeResponse & {
        success: boolean
        error?: { message: string }
      }

      if (!json.success) {
        setApiError(
          (json as unknown as { error?: { message: string } }).error?.message ??
            'Path change failed. Please try again.',
        )
        setIsSubmitting(false)
        return
      }

      onSuccess(json.active_path, json.cooldown_days)
    } catch {
      setApiError('Network error. Check your connection and try again.')
      setIsSubmitting(false)
    }
  }

  // ── Footer ───────────────────────────────────────────────────────────────

  const footer = (
    <button
      type="button"
      onClick={handleConfirm}
      disabled={!canConfirm}
      className={[
        'flex w-full items-center justify-center gap-2 rounded-lg py-2.5',
        'bg-muted-emerald font-sans text-sm font-medium text-white',
        'transition-colors duration-150 hover:bg-muted-emerald/90',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-muted-emerald focus-visible:ring-offset-2',
        'focus-visible:ring-offset-canvas-surface',
        'disabled:cursor-not-allowed disabled:opacity-50',
      ].join(' ')}
    >
      {isSubmitting ? (
        <>
          <Loader2 className="animate-spin" size={14} strokeWidth={2} aria-hidden="true" />
          <span>Confirming…</span>
        </>
      ) : (
        <>
          <ChevronRight size={14} strokeWidth={2.5} aria-hidden="true" />
          <span>Confirm Path Change</span>
        </>
      )}
    </button>
  )

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Modal
      title="Select Your Path"
      onClose={onClose}
      size="lg"
      footer={footer}
    >
      {/* Warning banner sits between header and path list */}
      <WarningBanner />

      {/* Path option list */}
      <div
        className="flex flex-col gap-3 p-6"
        role="radiogroup"
        aria-label="Available paths"
      >
        {PATH_LIST.map((meta) => (
          <PathOption
            key={meta.id}
            meta={meta}
            isCurrent={meta.id === currentPathId}
            isSelected={selectedId === meta.id}
            onSelect={() => {
              if (meta.id !== currentPathId) {
                setSelectedId(meta.id)
                setApiError(null)
              }
            }}
          />
        ))}
      </div>

      {/* API error — rendered inside the scrollable body, above the footer */}
      {apiError && (
        <div className="mx-6 mb-6 flex items-start gap-2 rounded-lg border border-terracotta/30 bg-terracotta/5 px-3 py-2.5">
          <AlertTriangle
            className="mt-0.5 shrink-0 text-terracotta"
            size={13}
            strokeWidth={2}
            aria-hidden="true"
          />
          <p className="font-sans text-xs text-terracotta">{apiError}</p>
        </div>
      )}
    </Modal>
  )
}

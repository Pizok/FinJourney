// ─── ResetProgressModal.tsx ───────────────────────────────────────────────────
// Destructive action dialog — resets Level, XP, HP, and region progress.
//
// Guardrail (settings_prd.md §3):
//   The user must type exactly "RESET" (case-sensitive, no coercion) into the
//   text input. Only then does the confirm button become enabled.
//
// Focus management:
//   Modal base handles escape + backdrop. This component passes `initialFocusRef`
//   pointing to the confirmation input, so keyboard users land directly on the
//   field that needs to be filled before anything can happen.
//
// Flow (settings_state_flow.md → Reset Progress Flow):
//   Type RESET → enable Confirm → POST /api/v1/settings/reset-progress
//   → onSuccess() → parent invalidates ['settings'] + redirects to /dashboard
//
// API:
//   POST /api/v1/settings/reset-progress
//   Body: { confirmation: "RESET" }
//   Response: { success, level, xp, hp }
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import { useId, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '../../ui/Modal'
import type { ResetProgressResponse } from '../types/settings.types'

// ─── Constant ─────────────────────────────────────────────────────────────────
// Declared as const so it is compared against exactly once and is easy to
// locate for any future policy change (e.g. locale-specific confirmation word).

const REQUIRED_KEYWORD = 'RESET' as const

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResetProgressModalProps {
  /** Called when the dialog is dismissed without committing. */
  onClose: () => void
  /**
   * Called after a successful POST.
   * Parent is responsible for:
   *   1. Invalidating ['settings'] and bootstrap state.
   *   2. Redirecting the user to /dashboard (progression has restarted).
   */
  onSuccess: (result: Pick<ResetProgressResponse, 'level' | 'xp' | 'hp'>) => void
}

// ─── ResetProgressModal ───────────────────────────────────────────────────────

export function ResetProgressModal({ onClose, onSuccess }: ResetProgressModalProps) {
  const inputId = useId()
  const errorId = useId()

  const [inputValue, setInputValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Passed to Modal as initialFocusRef — input receives focus on mount
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Case-sensitive exact match — no coercion ──────────────────────────────
  // Part 3's inline version applied .toUpperCase() which let users type in
  // any case. The PRD specifies "type RESET" as an explicit confirmation ritual;
  // silently correcting the case undermines that intent.
  const isConfirmed = inputValue === REQUIRED_KEYWORD
  const canSubmit = isConfirmed && !isSubmitting

  // ── Mutation ──────────────────────────────────────────────────────────────

  async function handleReset() {
    if (!canSubmit) return
    setIsSubmitting(true)
    setApiError(null)

    try {
      const res = await fetch('/api/v1/settings/reset-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirmation: REQUIRED_KEYWORD }),
      })

      const json = (await res.json()) as ResetProgressResponse & {
        success: boolean
        error?: { message: string }
      }

      if (!json.success) {
        setApiError(
          (json as unknown as { error?: { message: string } }).error?.message ??
            'Reset failed. Please try again.',
        )
        setIsSubmitting(false)
        return
      }

      onSuccess({ level: json.level, xp: json.xp, hp: json.hp })
    } catch {
      setApiError('Network error. Check your connection and try again.')
      setIsSubmitting(false)
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────

  const footer = (
    <div className="flex gap-3">
      {/* Cancel */}
      <button
        type="button"
        onClick={onClose}
        disabled={isSubmitting}
        className={[
          'flex-1 rounded-lg border border-tactical-border py-2.5',
          'font-sans text-sm font-medium text-pearl-text',
          'transition-colors duration-150',
          'hover:border-pearl-text/30 hover:bg-pearl-text/5',
          'focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-muted-emerald focus-visible:ring-offset-2',
          'focus-visible:ring-offset-canvas-surface',
          'disabled:cursor-not-allowed disabled:opacity-40',
        ].join(' ')}
      >
        Cancel
      </button>

      {/* Confirm Reset — solid terracotta, only enabled once keyword matches */}
      <button
        type="button"
        onClick={handleReset}
        disabled={!canSubmit}
        className={[
          'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5',
          'bg-terracotta font-sans text-sm font-medium text-white',
          'transition-colors duration-150 hover:bg-terracotta/90',
          'focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-terracotta focus-visible:ring-offset-2',
          'focus-visible:ring-offset-canvas-surface',
          'disabled:cursor-not-allowed disabled:opacity-40',
        ].join(' ')}
        aria-label={isSubmitting ? 'Resetting journey…' : 'Confirm reset'}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" size={14} strokeWidth={2} aria-hidden="true" />
            <span>Resetting…</span>
          </>
        ) : (
          <span>Confirm Reset</span>
        )}
      </button>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      isOpen={true}
      title="Reset Journey Progress?"
      onClose={onClose}
      size="md"
    >
      <Modal.Header>
        <h2 className="font-display text-lg font-semibold text-terracotta">
          Reset Journey Progress?
        </h2>
      </Modal.Header>
      
      <Modal.Body>
        <div className="py-2">

          {/* ── What resets ────────────────────────────────────────────────────── */}
          <p className="font-sans text-sm leading-relaxed text-muted-text">
            This will reset your{' '}
            <span className="font-medium text-pearl-text">Level to 1</span>,{' '}
            <span className="font-medium text-pearl-text">XP to 0</span>, and{' '}
            <span className="font-medium text-pearl-text">HP to 100</span>. Your
            region progress will restart.
          </p>

          {/* ── What does NOT reset ────────────────────────────────────────────── */}
          {/*
            Explicitly surfaced as a reassurance block to reduce abandonment.
            Financial data being untouched is the most common user concern before
            committing to a destructive progression action.
          */}
          <div className="mt-3 rounded-lg border border-tactical-border bg-abyssal-slate px-4 py-3">
            <p className="font-sans text-xs leading-relaxed text-muted-text">
              <span className="font-semibold text-pearl-text">
                Your financial data, wallets, and transaction history will not be
                deleted.
              </span>{' '}
              Loans, categories, and all recorded transactions remain exactly as
              they are.
            </p>
          </div>

          {/* ── Typed confirmation ─────────────────────────────────────────────── */}
          {/*
            No auto-uppercase coercion. The user must type the exact string.
            The label shows the target word in monospace terracotta so the
            visual contrast reinforces the seriousness of the action.
          */}
          <div className="mt-5">
            <label
              htmlFor={inputId}
              className="mb-1.5 block font-sans text-xs font-medium text-muted-text"
            >
              Type{' '}
              <span className="font-mono font-semibold text-terracotta">
                {REQUIRED_KEYWORD}
              </span>{' '}
              to enable the confirm button
            </label>

            <input
              ref={inputRef}
              id={inputId}
              type="text"
              value={inputValue}
              onChange={(e) => {
                // No coercion — raw value only
                setInputValue(e.target.value)
                if (apiError) setApiError(null)
              }}
              onKeyDown={(e) => {
                // Allow keyboard submission once confirmed
                if (e.key === 'Enter' && canSubmit) handleReset()
              }}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              placeholder={REQUIRED_KEYWORD}
              aria-describedby={apiError ? errorId : undefined}
              aria-invalid={apiError ? true : undefined}
              className={[
                'w-full rounded-lg border bg-abyssal-slate px-3 py-2.5',
                'font-mono text-sm tracking-widest text-pearl-text',
                'transition-colors duration-150',
                'placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-text/30',
                'focus:outline-none',
                // Border states: default → terracotta hint when correct → error
                apiError
                  ? 'border-terracotta ring-1 ring-terracotta/30'
                  : isConfirmed
                  ? 'border-terracotta/60'
                  : 'border-tactical-border focus:border-tactical-border/80',
              ].join(' ')}
            />

            {/* Character count guide — helps avoid invisible trailing spaces */}
            <div className="mt-1.5 flex items-center justify-between">
              <p
                id={apiError ? errorId : undefined}
                role={apiError ? 'alert' : undefined}
                className="font-sans text-xs text-terracotta"
              >
                {apiError ?? (
                  inputValue.length > 0 && !isConfirmed
                    ? 'Keep typing — must match exactly'
                    : ''
                )}
              </p>
              {/* Subtle character counter to catch trailing spaces */}
              <span
                className="font-mono text-[11px] tabular-nums text-muted-text/50"
                aria-hidden="true"
              >
                {inputValue.length}/{REQUIRED_KEYWORD.length}
              </span>
            </div>
          </div>
        </div>
      </Modal.Body>
      
      <Modal.Footer>{footer}</Modal.Footer>
    </Modal>
  )
}

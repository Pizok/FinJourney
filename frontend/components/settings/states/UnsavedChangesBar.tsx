// ─── UnsavedChangesBar.tsx ────────────────────────────────────────────────────
// Sticky bottom banner that appears when the user has unsaved edits.
//
// Behaviour:
//   • Slides up from the bottom edge when isDirty = true
//   • Slides back down (off-screen) when isDirty = false
//   • Discard → calls store.discard(), reverting to saved state
//   • Save Changes → triggers PATCH mutations (orchestrated by parent hooks)
//   • Shows a loading state on the Save button while isSaving = true
//   • Responds to keyboard (Enter on Save, Escape to Discard)
//
// Design (DESIGN.md):
//   • Canvas Surface background with Tactical Border top edge
//   • No shadows — flat surface system
//   • Primary CTA: solid Muted Emerald (not glowing — glow reserved for landing)
//   • Secondary: ghost button with Tactical Border
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import { useEffect, useCallback } from 'react'
import { Loader2, Check, AlertCircle } from 'lucide-react'
import {
  useSettingsStore,
  selectHasBlockingValidationErrors,
} from '../store/settingsStore'

// ─── External save trigger (injected via prop) ────────────────────────────────
// UnsavedChangesBar does not own the PATCH logic — it delegates upward.
// Consumers wire in an `onSave` callback that coordinates TanStack Query mutations.

interface UnsavedChangesBarProps {
  /**
   * Called when the user clicks Save Changes.
   * The parent is responsible for orchestrating all PATCH calls
   * and calling store.markSaved() on success.
   *
   * If omitted (e.g. during isolated dev), the button renders but is a no-op.
   */
  onSave?: () => Promise<void> | void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UnsavedChangesBar({ onSave }: UnsavedChangesBarProps) {
  const isDirty = useSettingsStore((s) => s.isDirty)
  const isSaving = useSettingsStore((s) => s.isSaving)
  const setSaving = useSettingsStore((s) => s.setSaving)
  const discard = useSettingsStore((s) => s.discard)
  const hasBlockingErrors = useSettingsStore(selectHasBlockingValidationErrors)

  const canSave = !isSaving && !hasBlockingErrors && !!onSave

  // ── Save handler ──────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!canSave || !onSave) return
    setSaving(true)
    try {
      await onSave()
      // markSaved() is called by the parent after successful mutations.
      // isSaving is cleared inside markSaved().
    } catch {
      // Error handling (toast) lives in the parent or mutation callbacks.
      setSaving(false)
    }
  }, [canSave, onSave, setSaving])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isDirty) return

      // Cmd/Ctrl + S — save (no-op if blocked by validation)
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (canSave) handleSave()
      }

      // Escape — discard (only when not inside an input/textarea)
      if (
        e.key === 'Escape' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        discard()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDirty, canSave, handleSave, discard])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    /*
      Outer wrapper handles the translate animation.
      Using CSS transitions on transform is correct per DESIGN.md (no layout animations).

      pointer-events-none when hidden ensures clicks pass through.
    */
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={[
        'fixed inset-x-0 bottom-0 z-50',
        'transition-transform duration-300 ease-out',
        isDirty ? 'translate-y-0' : 'translate-y-full',
        !isDirty && 'pointer-events-none',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/*
        Inner bar: Canvas Surface bg, Tactical Border top edge.
        Centered max-width container mirrors the page layout.
      */}
      <div className="border-t border-tactical-border bg-canvas-surface">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-6 py-4 lg:px-10">
          {/* ── Message ──────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2.5">
            {/*
              Dot indicator — subtle visual cue alongside the text.
              Switches to terracotta when a blocking validation error exists,
              and stops pulsing once saving begins.
            */}
            <span
              aria-hidden="true"
              className={[
                'h-2 w-2 rounded-full',
                hasBlockingErrors ? 'bg-terracotta' : 'bg-dawn-gold',
                !isSaving && 'animate-pulse',
              ]
                .filter(Boolean)
                .join(' ')}
            />
            <p className="font-sans text-sm text-pearl-text">
              You have unsaved changes.
            </p>

            {hasBlockingErrors ? (
              /*
                Validation blocker — replaces the keyboard hint.
                Points the user back to the offending field rather than
                repeating the full error message (already shown inline
                on the input itself).
              */
              <span className="flex items-center gap-1.5 font-sans text-xs text-terracotta">
                <AlertCircle size={13} strokeWidth={2} aria-hidden="true" />
                Fix the savings target before saving
              </span>
            ) : (
              /* Keyboard shortcut hint — desktop only */
              <span className="hidden font-sans text-xs text-muted-text lg:inline">
                Press{' '}
                <kbd className="rounded border border-tactical-border bg-abyssal-slate px-1.5 py-0.5 font-sans text-[11px] text-muted-text">
                  ⌘S
                </kbd>{' '}
                to save
              </span>
            )}
          </div>

          {/* ── Actions ──────────────────────────────────────────────────── */}
          <div className="flex shrink-0 items-center gap-3">
            {/* Discard */}
            <button
              type="button"
              onClick={discard}
              disabled={isSaving}
              className={[
                'rounded-lg border border-tactical-border px-4 py-2',
                'font-sans text-sm font-medium text-pearl-text',
                'transition-colors duration-150',
                'hover:border-pearl-text/40 hover:bg-pearl-text/5',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-emerald focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface',
                'disabled:cursor-not-allowed disabled:opacity-40',
              ].join(' ')}
              aria-label="Discard unsaved changes"
            >
              Discard
            </button>

            {/* Save Changes */}
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className={[
                'relative flex items-center gap-2 rounded-lg px-4 py-2',
                'bg-muted-emerald font-sans text-sm font-medium text-white',
                'transition-colors duration-150',
                'hover:bg-muted-emerald/90',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-emerald focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface',
                'disabled:cursor-not-allowed disabled:opacity-60',
              ].join(' ')}
              aria-label={
                hasBlockingErrors
                  ? 'Save changes disabled — fix validation errors first'
                  : isSaving
                  ? 'Saving changes...'
                  : 'Save changes'
              }
            >
              {isSaving ? (
                <>
                  <Loader2
                    className="animate-spin"
                    size={14}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

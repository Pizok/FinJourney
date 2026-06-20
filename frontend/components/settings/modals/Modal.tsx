// ─── Modal.tsx ────────────────────────────────────────────────────────────────
// Base modal shell shared by all Settings dialogs.
//
// Responsibilities (handled ONCE here, never duplicated in consumers):
//   • Portal rendering via createPortal → document.body
//   • Body scroll lock on open, restored on close
//   • Escape key → onClose
//   • Backdrop click → onClose
//   • Initial focus: jumps to `initialFocusRef` when provided, else close button
//   • Consistent visual shell: header, scrollable body, optional sticky footer
//
// Design (DESIGN.md):
//   • Canvas Surface background, Tactical Border edge
//   • No outer glow, no shadow — flat surface system
//   • animate-fade-in from globals.css (0.2s ease)
//   • Header never scrolls; body scrolls independently
//   • titleVariant="danger" applies --terracotta to the title (destructive actions)
//
// Usage:
//   <Modal title="Select Your Path" onClose={close} size="lg" footer={<Buttons />}>
//     {content}
//   </Modal>
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModalProps {
  /** Text displayed in the header. */
  title: string

  /** Called when the user dismisses the modal (X button, backdrop, Escape). */
  onClose: () => void

  /**
   * Controls the maximum width of the dialog container.
   *  sm  → max-w-sm  (384px)  — simple confirmations
   *  md  → max-w-md  (448px)  — default; most settings dialogs
   *  lg  → max-w-lg  (512px)  — content-rich; path selection
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg'

  /**
   * Overrides the header title colour.
   *  default → text-pearl-text
   *  danger  → text-terracotta   (use for destructive actions)
   * @default 'default'
   */
  titleVariant?: 'default' | 'danger'

  /** Main content rendered inside the scrollable body region. */
  children: ReactNode

  /**
   * Optional sticky footer rendered below a Tactical Border separator.
   * Intended for action buttons. Does not participate in body scroll.
   */
  footer?: ReactNode

  /**
   * When provided, this element receives focus on mount instead of the close
   * button. Use to surface the most critical interactive control immediately
   * (e.g., the confirmation text input in ResetProgressModal).
   */
  initialFocusRef?: RefObject<HTMLElement | null>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SIZE_MAP: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-lg',
  md: 'max-w-lg',
  lg: 'max-w-lg',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Modal({
  title,
  onClose,
  size = 'md',
  titleVariant = 'default',
  children,
  footer,
  initialFocusRef,
}: ModalProps) {
  // ── SSR guard ─────────────────────────────────────────────────────────────
  // createPortal requires document.body. The modal only renders after the
  // component mounts on the client, preventing hydration mismatches.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // ── Accessibility IDs ─────────────────────────────────────────────────────
  const titleId = useId()

  // ── Close button ref (fallback focus target) ──────────────────────────────
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // ── Initial focus ─────────────────────────────────────────────────────────
  // Prioritise initialFocusRef (e.g., a text input) over the close button.
  // Small delay lets the entry animation start before focus rings appear.
  useEffect(() => {
    if (!mounted) return
    const target = initialFocusRef?.current ?? closeButtonRef.current
    const timer = window.setTimeout(() => target?.focus(), 60)
    return () => window.clearTimeout(timer)
  }, [mounted, initialFocusRef])

  // ── Escape key ────────────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // ── Body scroll lock ──────────────────────────────────────────────────────
  // Preserves the original overflow value so it is correctly restored if the
  // page itself had overflow:hidden before the modal opened.
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  // ── Don't render during SSR ───────────────────────────────────────────────
  if (!mounted) return null

  // ── Portal content ────────────────────────────────────────────────────────
  const content = (
    <>
      {/* ── Backdrop ───────────────────────────────────────────────────────── */}
      {/*
        Separate from the dialog so that pointer-events on the dialog
        do not interfere with the click-outside-to-close behaviour.
      */}
      <div
        className="fixed inset-0 z-50 bg-abyssal-slate/80 animate-fade-in"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* ── Dialog ─────────────────────────────────────────────────────────── */}
      {/*
        Layout: flex column with a fixed max-height.
        Header and footer are shrink-0 (never scroll).
        Body region is flex-1 + overflow-y-auto (scrolls independently).
      */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={[
          // Positioning
          'fixed left-1/2 top-1/2 z-50 w-full',
          '-translate-x-1/2 -translate-y-1/2',
          // Sizing
          SIZE_MAP[size],
          'max-h-[90dvh]',
          // Layout
          'flex flex-col',
          // Surface — flat, no shadow, Tactical Border edge
          'rounded-xl border border-tactical-border bg-canvas-surface',
          // Entry animation (defined in globals.css)
          'animate-fade-in',
        ].join(' ')}
        // Prevent backdrop click from propagating to dialog
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header — sticky, never scrolls ───────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-b border-tactical-border px-6 py-5">
          <h2
            id={titleId}
            className={[
              'font-display text-base font-semibold',
              titleVariant === 'danger' ? 'text-terracotta' : 'text-pearl-text',
            ].join(' ')}
          >
            {title}
          </h2>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className={[
              'rounded-md p-1.5 text-muted-text',
              'transition-colors duration-150',
              'hover:bg-tactical-border/40 hover:text-pearl-text',
              'focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-muted-emerald focus-visible:ring-offset-1',
              'focus-visible:ring-offset-canvas-surface',
            ].join(' ')}
            aria-label="Close dialog"
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/* ── Body — scrollable ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* ── Footer — sticky, never scrolls ───────────────────────────────── */}
        {footer !== undefined && (
          <div className="shrink-0 border-t border-tactical-border px-6 py-5">
            {footer}
          </div>
        )}
      </div>
    </>
  )

  return createPortal(content, document.body)
}

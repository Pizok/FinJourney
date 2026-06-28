'use client';

// =============================================================================
// components/wallet/modals/BaseModal.tsx — FinJourney
//
// Shared portal shell used by all 6 Wallet modals.
//
// Provides:
//   - Portal rendering into document.body (avoids z-index stacking)
//   - Backdrop with click-to-close
//   - Focus trap (Tab / Shift+Tab cycle within modal, first element auto-focused)
//   - ESC key close handler
//   - Body scroll lock while open
//   - Fade-in animation (globals.css .animate-fade-in)
//   - aria-modal, role="dialog", aria-labelledby wiring
//
// Named exports:
//   - BaseModal       — the shell
//   - FormField       — accessible label + input wrapper with inline error
//   - FormTextarea    — textarea variant of FormField
//   - FormSelect      — styled native select with chevron
//   - ModalFooter     — standardised button row (primary + ghost)
//   - DangerZone      — red-bordered section for destructive actions
// =============================================================================

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type HTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type InputHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';

// ---------------------------------------------------------------------------
// SSR mount guard
// ---------------------------------------------------------------------------

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted;
}

// ---------------------------------------------------------------------------
// Focusable element query (for focus trap)
// ---------------------------------------------------------------------------

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

// ---------------------------------------------------------------------------
// BaseModal Props
// ---------------------------------------------------------------------------

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Rendered as the accessible dialog title and the visible header text. */
  title: string;
  /** Controls max-width of the modal panel. Defaults to 'md'. */
  maxWidth?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  /**
   * If true, no close button is rendered in the header
   * (e.g. a warning modal where the CTA is the close path).
   */
  hideCloseButton?: boolean;
}

// ---------------------------------------------------------------------------
// BaseModal
// ---------------------------------------------------------------------------

const MAX_WIDTH_CLASSES = {
  sm: 'max-w-lg',
  md: 'max-w-lg',
  lg: 'max-w-lg',
};

export function BaseModal({
  isOpen,
  onClose,
  title,
  maxWidth = 'md',
  children,
  hideCloseButton = false,
}: BaseModalProps) {
  const mounted = useMounted();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = `modal-title-${title.replace(/\s+/g, '-').toLowerCase()}`;

  // -------------------------------------------------------------------------
  // Focus trap + ESC key
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;

    // Auto-focus first focusable element, unless an input is already focused
    const timer = setTimeout(() => {
      const active = document.activeElement;
      if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return;
      
      const first = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)[0];
      first?.focus();
    }, 50);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  // -------------------------------------------------------------------------
  // Body scroll lock
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    /*
     * Backdrop — semi-transparent black, fixed, full-screen.
     * Click outside the dialog panel calls onClose.
     */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-hidden="false"
    >
      {/*
       * Dialog panel — Canvas Surface, rounded-xl, spacious padding.
       * NO glassmorphism, NO gradient, NO outer glow.
       * Fade-in via .animate-fade-in from globals.css.
       */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={[
          'animate-fade-in',
          'relative w-full flex flex-col',
          MAX_WIDTH_CLASSES[maxWidth],
          'rounded-xl bg-[var(--color-canvas-surface)]',
          'border border-[var(--color-tactical-border)]',
          // Subtle shadow — no glow, non-colored per DESIGN.md
          'shadow-2xl shadow-black/50',
          'max-h-[90vh] overflow-y-auto',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ---------------------------------------------------------------- */}
        {/* Modal header                                                     */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex items-center justify-between gap-4 border-b border-[var(--color-tactical-border)] px-6 py-5">
          <h2
            id={titleId}
            className="font-display text-base font-semibold text-[var(--color-pearl-text)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {title}
          </h2>

          {!hideCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className={[
                'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md',
                'text-[var(--color-muted-text)] transition-colors',
                'hover:bg-[var(--color-abyssal-slate)] hover:text-[var(--color-pearl-text)]',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1',
                'focus-visible:outline-[var(--color-muted-emerald)]',
              ].join(' ')}
            >
              {/* X icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Modal body — children render here                               */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex-1 px-6 py-5">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// =============================================================================
// Shared Form Primitives
// =============================================================================
// Exported and used by all modal files.

// ---------------------------------------------------------------------------
// Shared input class string
// ---------------------------------------------------------------------------

export const inputBase = [
  'w-full rounded-lg px-3.5 py-2.5',
  'bg-[var(--color-abyssal-slate)]',
  'border border-[var(--color-tactical-border)]',
  'text-sm text-[var(--color-pearl-text)]',
  'placeholder:text-[var(--color-muted-text)]',
  'transition-colors duration-150',
  'focus:outline-none focus:border-[var(--color-muted-emerald)]',
  '[color-scheme:dark]',
].join(' ');

export const inputError = 'border-[var(--color-terracotta)] focus:border-[var(--color-terracotta)]';

// ---------------------------------------------------------------------------
// FormField
// ---------------------------------------------------------------------------

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

export function FormField({ label, htmlFor, error, hint, required, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-[var(--color-pearl-text)]"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {label}
        {required && (
          <span className="ml-1 text-[var(--color-terracotta)]" aria-hidden="true">*</span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-[var(--color-muted-text)]" style={{ fontFamily: 'var(--font-sans)' }}>
          {hint}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="text-xs text-[var(--color-terracotta)]"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FormTextarea
// ---------------------------------------------------------------------------

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export function FormTextarea({ hasError, className = '', ...props }: FormTextareaProps) {
  return (
    <textarea
      rows={3}
      className={[
        inputBase,
        hasError ? inputError : '',
        'resize-none',
        className,
      ].join(' ')}
      style={{ fontFamily: 'var(--font-sans)' }}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// FormInput
// ---------------------------------------------------------------------------

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function FormInput({ hasError, className = '', ...props }: FormInputProps) {
  return (
    <input
      className={[
        inputBase,
        hasError ? inputError : '',
        className,
      ].join(' ')}
      style={{ fontFamily: 'var(--font-sans)' }}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// FormCurrencyInput
// ---------------------------------------------------------------------------

interface FormCurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  hasError?: boolean;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function FormCurrencyInput({ hasError, className = '', value, onChange, ...props }: FormCurrencyInputProps) {
  const displayValue = value === '' || value === undefined || value === null || isNaN(Number(value))
    ? ''
    : Number(String(value).replace(/\D/g, '')).toLocaleString('id-ID');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const newEvent = {
      ...e,
      target: { ...e.target, value: rawValue }
    } as React.ChangeEvent<HTMLInputElement>;
    onChange(newEvent);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      className={[
        inputBase,
        hasError ? inputError : '',
        className,
      ].join(' ')}
      style={{ fontFamily: 'var(--font-sans)' }}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// FormSelect
// ---------------------------------------------------------------------------

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export function FormSelect({ hasError, className = '', children, ...props }: FormSelectProps) {
  return (
    <div className="relative">
      <select
        className={[
          inputBase,
          hasError ? inputError : '',
          'cursor-pointer appearance-none pr-9',
          className,
        ].join(' ')}
        style={{ fontFamily: 'var(--font-sans)' }}
        {...props}
      >
        {children}
      </select>
      {/* Chevron */}
      <svg
        xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-text)]"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ModalFooter
// ---------------------------------------------------------------------------

interface ModalFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function ModalFooter({ children, className = '', ...props }: ModalFooterProps) {
  return (
    <div
      className={[
        'flex items-center justify-end gap-3',
        'border-t border-[var(--color-tactical-border)]',
        'px-6 py-4 mt-2',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}

// Primary action button
export function PrimaryButton({
  children,
  className = '',
  danger = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      type="button"
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5',
        'text-sm font-medium text-white transition-opacity',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        danger
          ? 'bg-[var(--color-terracotta)] focus-visible:outline-[var(--color-terracotta)] hover:opacity-90'
          : 'bg-[var(--color-muted-emerald)] focus-visible:outline-[var(--color-muted-emerald)] hover:opacity-90',
        className,
      ].join(' ')}
      style={{ fontFamily: 'var(--font-sans)' }}
      {...props}
    >
      {children}
    </button>
  );
}

// Ghost / cancel button
export function GhostButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5',
        'border border-[var(--color-tactical-border)]',
        'text-sm font-medium text-[var(--color-pearl-text)]',
        'transition-colors hover:border-[var(--color-muted-text)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'focus-visible:outline-[var(--color-muted-emerald)]',
        className,
      ].join(' ')}
      style={{ fontFamily: 'var(--font-sans)' }}
      {...props}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// DangerZone — red-bordered section for destructive actions
// ---------------------------------------------------------------------------

export function DangerZone({ children }: { children: ReactNode }) {
  return (
    <div
      className={[
        'rounded-lg border border-[var(--color-terracotta)]/30',
        'bg-[var(--color-terracotta)]/5 p-4',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

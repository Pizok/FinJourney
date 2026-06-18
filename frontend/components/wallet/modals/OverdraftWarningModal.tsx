'use client';

// =============================================================================
// components/wallet/modals/OverdraftWarningModal.tsx — FinJourney
//
// Prop-controlled warning shown when a transaction would push a wallet balance
// below zero. Controlled by the parent (AddTransaction flow) via props — not
// by the global Zustand store — since it is transient within a single
// transaction submission cycle.
//
// Copywriting (exact per spec):
//   Title: "Insufficient Balance Warning"
//   Body:  "This transaction will reduce the wallet balance below zero.
//           Do you want to continue?"
//   CTAs:  "Continue Anyway" | "Cancel"
// =============================================================================

import { BaseModal, ModalFooter, GhostButton } from './BaseModal';

interface OverdraftWarningModalProps {
  isOpen: boolean;
  /** Called when the user accepts and wants to proceed with the transaction. */
  onConfirm: () => void;
  /** Called when the user cancels and wants to revise the transaction. */
  onCancel: () => void;
}

export function OverdraftWarningModal({
  isOpen,
  onConfirm,
  onCancel,
}: OverdraftWarningModalProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      // Exact title per spec
      title="Insufficient Balance Warning"
      maxWidth="sm"
    >
      <div className="flex flex-col gap-4">
        {/* Warning icon container */}
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className={[
              'mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
              'bg-[var(--color-dawn-gold)]/10 text-[var(--color-dawn-gold)]',
            ].join(' ')}
          >
            {/* Warning triangle — Lucide style, strokeWidth 2 */}
            <svg
              xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>

          {/* Body — exact copy per spec */}
          <p
            className="text-sm leading-relaxed text-[var(--color-muted-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            This transaction will reduce the wallet balance below zero. Do you want to continue?
          </p>
        </div>
      </div>

      <ModalFooter>
        {/* Cancel — returns user to the transaction form */}
        <GhostButton onClick={onCancel}>
          Cancel
        </GhostButton>

        {/*
         * "Continue Anyway" — uses Dawn Gold (warning colour) rather than
         * Terracotta (danger) since this is a caution, not a destructive act.
         * No glow — dashboard rule applies.
         */}
        <button
          type="button"
          onClick={onConfirm}
          className={[
            'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5',
            'bg-[var(--color-dawn-gold)] text-sm font-medium',
            'text-[var(--color-abyssal-slate)]',
            'transition-opacity hover:opacity-90',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
            'focus-visible:outline-[var(--color-dawn-gold)]',
          ].join(' ')}
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          Continue Anyway
        </button>
      </ModalFooter>
    </BaseModal>
  );
}

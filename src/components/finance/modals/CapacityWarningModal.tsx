'use client';

// =============================================================================
// components/wallet/modals/CapacityWarningModal.tsx — FinJourney
//
// Informational modal shown when the user attempts to create a wallet or
// category beyond the limit for their current level.
//
// Architecture:
//   This modal is prop-controlled (isOpen / onClose) rather than wired to
//   the global Zustand store. Its trigger context is local:
//     - WalletCardList: when the "Add Wallet" button is clicked at the limit.
//     - Future: category creation when at the 10-category cap.
//
//   To use, lift a simple boolean flag in the parent:
//     const [showCapacity, setShowCapacity] = useState(false);
//     <CapacityWarningModal isOpen={showCapacity} onClose={() => setShowCapacity(false)} />
//
// Copywriting (exact per spec):
//   Title: "Wallet Limit Reached"
//   Body:  "Your current level supports up to 3 wallets and 10 categories.
//           Reach Level 3 to unlock unlimited wallet and category creation."
//   CTA:   "Understood"
// =============================================================================

import {
  BaseModal, ModalFooter, PrimaryButton,
} from '@/components/shared/modals/BaseModal';

interface CapacityWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CapacityWarningModal({ isOpen, onClose }: CapacityWarningModalProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      // Exact title per spec
      title="Wallet Limit Reached"
      maxWidth="sm"
    >
      <div className="flex flex-col gap-4">

        {/* Icon + body row */}
        <div className="flex items-start gap-3">
          {/*
           * Lock icon in steel-violet container.
           * Steel Violet is the secondary accent — appropriate for
           * a level-gate (progression, not danger).
           */}
          <div
            aria-hidden="true"
            className={[
              'mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
              'bg-[var(--color-steel-violet)]/10 text-[var(--color-steel-violet)]',
            ].join(' ')}
          >
            {/* Lock icon — Lucide style, strokeWidth 2 */}
            <svg
              xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          {/* Body — exact copy per spec */}
          <p
            className="text-sm leading-relaxed text-[var(--color-muted-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Your current level supports up to 3 wallets and 10 categories.
            Reach Level 3 to unlock unlimited wallet and category creation.
          </p>
        </div>

        {/* Level context row — reinforces the progression narrative */}
        <div className="flex items-center gap-3 rounded-lg bg-[var(--color-abyssal-slate)] px-4 py-3">
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-between">
              <span
                className="text-xs text-[var(--color-muted-text)]"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                Wallets
              </span>
              <span
                className="text-xs font-medium text-[var(--color-pearl-text)]"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                3 / 3
              </span>
            </div>
            {/* Progress bar — at cap */}
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-tactical-border)]/40"
              role="progressbar"
              aria-valuenow={100}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Wallet capacity: full"
            >
              <div className="h-full w-full rounded-full bg-[var(--color-steel-violet)]" />
            </div>

            <div className="mt-1 flex items-center justify-between">
              <span
                className="text-xs text-[var(--color-muted-text)]"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                Categories
              </span>
              <span
                className="text-xs font-medium text-[var(--color-pearl-text)]"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                10 / 10
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-tactical-border)]/40"
              role="progressbar"
              aria-valuenow={100}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Category capacity: full"
            >
              <div className="h-full w-full rounded-full bg-[var(--color-steel-violet)]" />
            </div>
          </div>
        </div>
      </div>

      {/* Single CTA — exact copy per spec: "Understood" */}
      <ModalFooter>
        <PrimaryButton onClick={onClose}>
          Understood
        </PrimaryButton>
      </ModalFooter>
    </BaseModal>
  );
}

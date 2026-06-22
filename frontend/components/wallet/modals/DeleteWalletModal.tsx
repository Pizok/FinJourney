'use client';

// =============================================================================
// components/wallet/modals/DeleteWalletModal.tsx — FinJourney
//
// High-friction confirmation modal for permanently removing a wallet.
// The delete button stays disabled until the user types the wallet's exact name.
//
// Last-wallet protection (from wallet_prd.md):
//   The delete button is permanently disabled when only one wallet remains.
//   A tooltip-style notice explains why (exact copy from spec).
//
// Copywriting (exact per spec):
//   Title:       "Delete Wallet"
//   Body:        "Deleting this wallet will prevent future transactions from
//                 using it. To confirm, type the wallet name below."
//   Placeholder: "Type wallet name..."
//   CTA:         "Delete Wallet"
//   Tooltip:     "At least one active wallet is required to continue using
//                 FinJourney."
//
// Mutations:
//   Real DELETE /api/v1/wallets/:id is drafted and commented out.
//   Optimistic: removeWallet() is called immediately.
//   Use "// TODO: Uncomment real mutation" marker to find it.
// =============================================================================

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BaseModal, GhostButton, PrimaryButton, inputBase,
} from './BaseModal';
import { useWalletStore } from '@/components/wallet/stores/walletStore';

export function DeleteWalletModal() {
  const {
    wallets,
    loading,
    ui: { isDeleteWalletOpen, activeDeleteWalletId },
    closeDeleteWallet,
    addWallet,
    removeWallet,
    setLoading,
    setGlobalError,
  } = useWalletStore();

  const wallet = activeDeleteWalletId
    ? wallets.find((w) => w.id === activeDeleteWalletId) ?? null
    : null;

  const [confirmText, setConfirmText]   = useState('');
  const isLastWallet  = wallets.length <= 1;
  const nameMatches   = confirmText.trim() === wallet?.name.trim();
  const canDelete     = nameMatches && !isLastWallet && !loading.mutation;

  // Reset confirmation text every time the modal opens
  useEffect(() => {
    if (isDeleteWalletOpen) setConfirmText('');
  }, [isDeleteWalletOpen]);

  const handleClose = () => {
    setConfirmText('');
    closeDeleteWallet();
  };

  const queryClient = useQueryClient();

  const deleteWalletMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/v1/wallets/${id}`, {
        method: 'DELETE',
      });
      // 204 No Content for success
      if (!response.ok) {
        let errorMsg = 'Failed to delete wallet';
        try {
          const json = await response.json();
          errorMsg = json.error?.message || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'bootstrap'] });
      handleClose();
    },
    onError: (err: any) => {
      setGlobalError(err.message);
    }
  });

  // -------------------------------------------------------------------------
  // Delete handler
  // -------------------------------------------------------------------------
  const handleDelete = async () => {
    if (!wallet || !canDelete) return;
    deleteWalletMutation.mutate(wallet.id);
  };

  if (!wallet) return null;

  return (
    <BaseModal
      isOpen={isDeleteWalletOpen}
      onClose={handleClose}
      // Exact title per spec
      title="Delete Wallet"
      maxWidth="sm"
    >
      <div className="flex flex-col gap-5">

        {/* Wallet identity preview */}
        <div className="flex items-center gap-3 rounded-lg bg-[var(--color-abyssal-slate)] px-4 py-3">
          <svg
            xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
            className="flex-shrink-0 text-[var(--color-muted-text)]"
          >
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
          <span
            className="text-sm font-medium text-[var(--color-pearl-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {wallet.name}
          </span>
        </div>

        {/*
         * Last-wallet protection banner.
         * Exact tooltip text per spec.
         */}
        {isLastWallet && (
          <div
            role="status"
            className={[
              'rounded-lg border border-[var(--color-tactical-border)]',
              'bg-[var(--color-canvas-surface)] px-4 py-3',
            ].join(' ')}
          >
            <p
              className="text-xs text-[var(--color-muted-text)]"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              {/* Exact tooltip copy per spec */}
              At least one active wallet is required to continue using FinJourney.
            </p>
          </div>
        )}

        {/* Body — exact copy per spec */}
        <p
          className="text-sm leading-relaxed text-[var(--color-muted-text)]"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          Deleting this wallet will prevent future transactions from using it.
          To confirm, type the wallet name below.
        </p>

        {/* Name confirmation input */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="delete-wallet-confirm"
            className="text-sm font-medium text-[var(--color-pearl-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Confirm wallet name
          </label>
          <input
            id="delete-wallet-confirm"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            // Exact placeholder copy per spec
            placeholder="Type wallet name..."
            disabled={isLastWallet || loading.mutation}
            autoComplete="off"
            className={[
              inputBase,
              !isLastWallet && confirmText && nameMatches
                ? 'border-[var(--color-muted-emerald)]'
                : !isLastWallet && confirmText && !nameMatches
                  ? 'border-[var(--color-terracotta)]'
                  : '',
            ].join(' ')}
            style={{ fontFamily: 'var(--font-sans)' }}
          />
          {/* Inline mismatch hint */}
          {!isLastWallet && confirmText && !nameMatches && (
            <p
              className="text-xs text-[var(--color-terracotta)]"
              style={{ fontFamily: 'var(--font-sans)' }}
              role="alert"
            >
              Name doesn't match. Check capitalisation and spacing.
            </p>
          )}
          {/* Match success hint */}
          {!isLastWallet && nameMatches && confirmText && (
            <p
              className="text-xs text-[var(--color-muted-emerald)]"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              Name confirmed. You may now delete this wallet.
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-end gap-3 border-t border-[var(--color-tactical-border)] px-6 py-4">
        <GhostButton onClick={handleClose} disabled={deleteWalletMutation.isPending}>
          Cancel
        </GhostButton>

        {/* Exact CTA copy per spec: "Delete Wallet" */}
        <PrimaryButton
          onClick={handleDelete}
          disabled={!canDelete || deleteWalletMutation.isPending}
          danger
          aria-disabled={!canDelete || deleteWalletMutation.isPending}
          aria-busy={deleteWalletMutation.isPending}
        >
          {deleteWalletMutation.isPending ? 'Deleting…' : 'Delete Wallet'}
        </PrimaryButton>
      </div>
    </BaseModal>
  );
}

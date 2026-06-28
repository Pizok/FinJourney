'use client';

// =============================================================================
// components/wallet/modals/DeleteTransactionModal.tsx — FinJourney
//
// Standard soft-delete confirmation for a single transaction.
//
// Architecture note (from logic.md + wallet_data_contract.md):
//   This is a SOFT DELETE only. The backend does not hard-delete the database
//   row. Instead, it creates a compensating adjustment event in game_events and
//   marks the transaction row as deleted. Historical snapshots are unaffected —
//   any HP/XP consequences from the original transaction are NOT reversed.
//
// Copywriting (exact per spec):
//   Title: "Delete Transaction"
//   Body:  "Are you sure you want to delete this transaction? Your current
//           balances will be updated, but previous progression records will
//           remain unchanged."
//   CTAs:  "Delete Transaction" | "Cancel"
//
// Mutations:
//   Real DELETE /api/v1/transactions/:id is drafted and commented out.
//   Optimistic: optimisticDeleteTransaction() removes the row from the
//   visible list immediately.
// =============================================================================

import { apiFetchClient } from '@/lib/apiClient.client';
import { useWalletStore } from '@/components/finance/stores/walletStore';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BaseModal, ModalFooter, GhostButton, PrimaryButton,
} from '@/components/shared/modals/BaseModal';
import type { TransactionType } from '@/types/wallet.types';

// ---------------------------------------------------------------------------
// Amount display helpers
// ---------------------------------------------------------------------------

const formatIDR = (n: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const AMOUNT_CLASS: Record<TransactionType, string> = {
  income:   'text-[var(--color-muted-emerald)]',
  expense:  'text-[var(--color-terracotta)]',
  transfer: 'text-[var(--color-muted-text)]',
};

const AMOUNT_PREFIX: Record<TransactionType, string> = {
  income:   '+',
  expense:  '−',
  transfer: '',
};

const TYPE_LABEL: Record<TransactionType, string> = {
  income:   'Income',
  expense:  'Expense',
  transfer: 'Transfer',
};

const TYPE_BG: Record<TransactionType, string> = {
  income:   'bg-[var(--color-muted-emerald)]/10 text-[var(--color-muted-emerald)]',
  expense:  'bg-[var(--color-terracotta)]/10 text-[var(--color-terracotta)]',
  transfer: 'bg-[var(--color-steel-violet)]/10 text-[var(--color-steel-violet)]',
};

const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(iso));

// ---------------------------------------------------------------------------
// DeleteTransactionModal
// ---------------------------------------------------------------------------

export function DeleteTransactionModal() {
  const {
    transactions,
    loading,
    ui: { isDeleteTransactionOpen, activeDeleteTransactionId },
    closeDeleteTransaction,
    optimisticDeleteTransaction,
    setLoading,
    setGlobalError,
  } = useWalletStore();

  const transaction = activeDeleteTransactionId
    ? (transactions.find((t) => t.id === activeDeleteTransactionId) ?? null)
    : null;

  const handleClose = () => closeDeleteTransaction();

  const queryClient = useQueryClient();

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiFetchClient(`transactions/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'bootstrap'] });
      queryClient.invalidateQueries({ queryKey: ['journey'] });
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
    if (!transaction) return;
    deleteTransactionMutation.mutate(transaction.id);
  };

  return (
    <BaseModal
      isOpen={isDeleteTransactionOpen}
      onClose={handleClose}
      // Exact title per spec
      title="Delete Transaction"
      maxWidth="sm"
    >
      <div className="flex flex-col gap-4">

        {/* Transaction preview card */}
        {transaction && (
          <div className="rounded-lg bg-[var(--color-abyssal-slate)] px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">

              {/* Left: meta */}
              <div className="flex min-w-0 flex-col gap-1">
                {/* Type badge + date */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={[
                      'inline-block rounded-md px-2 py-0.5 text-xs font-medium',
                      TYPE_BG[transaction.type],
                    ].join(' ')}
                    style={{ fontFamily: 'var(--font-sans)' }}
                  >
                    {TYPE_LABEL[transaction.type]}
                  </span>
                  <span
                    className="text-xs text-[var(--color-muted-text)]"
                    style={{ fontFamily: 'var(--font-sans)' }}
                  >
                    {formatDate(transaction.created_at)}
                  </span>
                </div>

                {/* Category / description */}
                {transaction.category_name && (
                  <p
                    className="text-sm font-medium text-[var(--color-pearl-text)]"
                    style={{ fontFamily: 'var(--font-sans)' }}
                  >
                    {transaction.category_name}
                  </p>
                )}

                {/* Wallet name */}
                <span
                  className="inline-block w-fit rounded bg-[var(--color-tactical-border)]/30 px-1.5 py-0.5 text-xs text-[var(--color-muted-text)]"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  {transaction.wallet_name}
                </span>

                {/* Note */}
                {transaction.note && (
                  <p
                    className="truncate text-xs text-[var(--color-muted-text)]"
                    style={{ fontFamily: 'var(--font-sans)' }}
                  >
                    {transaction.note}
                  </p>
                )}
              </div>

              {/* Right: amount */}
              <span
                className={[
                  'flex-shrink-0 text-sm font-semibold tabular-nums',
                  AMOUNT_CLASS[transaction.type],
                ].join(' ')}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {AMOUNT_PREFIX[transaction.type]}
                {formatIDR(transaction.amount)}
              </span>
            </div>

            {/* Adjustment row notice */}
            {transaction.is_adjustment_event && (
              <p
                className="mt-2.5 border-t border-[var(--color-tactical-border)]/50 pt-2.5 text-xs text-[var(--color-muted-text)]"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                This is an adjustment entry. The original transaction record will be preserved.
              </p>
            )}
          </div>
        )}

        {/* Body — exact copy per spec */}
        <p
          className="text-sm leading-relaxed text-[var(--color-muted-text)]"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          Are you sure you want to delete this transaction? Your current balances will be updated, but previous progression records will remain unchanged.
        </p>
      </div>

      {/* Footer — exact CTA copy per spec */}
      <ModalFooter>
        <GhostButton onClick={handleClose} disabled={deleteTransactionMutation.isPending}>
          Cancel
        </GhostButton>
        <PrimaryButton
          onClick={handleDelete}
          disabled={!transaction || deleteTransactionMutation.isPending}
          danger
          aria-busy={deleteTransactionMutation.isPending}
        >
          {deleteTransactionMutation.isPending ? 'Deleting…' : 'Delete Transaction'}
        </PrimaryButton>
      </ModalFooter>
    </BaseModal>
  );
}


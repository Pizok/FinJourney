'use client';

// =============================================================================
// components/wallet/modals/EditTransactionModal.tsx — FinJourney
//
// Modal for editing an existing transaction.
//
// Editable fields (per wallet_data_contract.md EditTransactionPayload):
//   Amount | Category | Payment Method | Note
//
// Non-editable: type, wallet, date (creating an adjustment event server-side)
//
// CTAs: "Save Changes" | "Cancel"
//
// Mutations:
//   Optimistic: optimisticUpdateTransaction() updates the row immediately.
//   Real PATCH /api/v1/transactions/:id is drafted and commented out.
//
// Note: editing creates a backend adjustment event — original daily_snapshot
// is locked; HP already taken is NOT reversed.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Wallet as WalletIcon, CheckCircle2, ChevronDown } from 'lucide-react';
import { apiFetchClient } from '@/lib/apiClient.client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BaseModal, FormField, FormInput, FormCurrencyInput, FormTextarea, FormSelect,
  ModalFooter, PrimaryButton, GhostButton,
} from '@/components/shared/modals/BaseModal';
import { useWalletStore, selectEditTransaction } from '@/components/finance/stores/walletStore';
import type { PaymentMethod } from '@/types/wallet.types';

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

interface FormValues {
  amount: string;
  wallet_id: string;
  source_wallet_id: string;
  destination_wallet_id: string;
  category_id: string;
  payment_method: PaymentMethod;
  note: string;
}

interface FormErrors {
  amount?: string;
  wallet_id?: string;
  source_wallet_id?: string;
  destination_wallet_id?: string;
}

function validate(v: FormValues): FormErrors {
  const e: FormErrors = {};
  const n = parseFloat(v.amount);
  if (v.amount.trim() === '' || isNaN(n)) {
    e.amount = 'Amount is required.';
  } else if (n <= 0) {
    e.amount = 'Amount must be greater than 0.';
  }

  // When we add wallet editing (wallet_id is passed down for income/expense)
  if (v.source_wallet_id && v.destination_wallet_id && v.source_wallet_id === v.destination_wallet_id) {
    e.destination_wallet_id = 'Source and destination must be different.';
  }

  return e;
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',        label: 'Cash' },
  { value: 'debit_card',  label: 'Debit Card' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'transfer',    label: 'Bank/E-wallet Transfer' },
  { value: 'qr_code',     label: 'QR Code' },
];

const TYPE_LABELS: Record<string, string> = {
  income:   'Income',
  expense:  'Expense',
  transfer: 'Transfer',
};

// ---------------------------------------------------------------------------
// EditTransactionModal
// ---------------------------------------------------------------------------

export function EditTransactionModal() {
  const {
    wallets,
    categories,
    loading,
    ui: { isEditTransactionOpen },
    closeEditTransaction,
    optimisticUpdateTransaction,
    setGlobalError,
  } = useWalletStore();

  const transaction = useWalletStore(selectEditTransaction);

  const [values, setValues] = useState<FormValues>({
    amount: '',
    wallet_id: '',
    source_wallet_id: '',
    destination_wallet_id: '',
    category_id: '',
    payment_method: 'cash',
    note: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  // Populate form when transaction changes (i.e., when modal opens)
  useEffect(() => {
    if (transaction) {
      setValues({
        amount:         String(transaction.amount),
        wallet_id:      transaction.wallet_id ?? '',
        source_wallet_id: transaction.source_wallet_id ?? '',
        destination_wallet_id: transaction.destination_wallet_id ?? '',
        category_id:    transaction.category_id ?? '',
        payment_method: transaction.payment_method ?? 'cash',
        note:           transaction.note ?? '',
      });
      setErrors({});
      setSubmitted(false);
    }
  }, [transaction]);

  const handleClose = useCallback(() => {
    closeEditTransaction();
  }, [closeEditTransaction]);

  const setField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (submitted) setErrors(validate(next));
      return next;
    });
  };

  const queryClient = useQueryClient();

  const updateTransactionMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!transaction) throw new Error('No transaction to edit');
      return apiFetchClient(`transactions/${transaction.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'bootstrap'] });
      queryClient.invalidateQueries({ queryKey: ['journey'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      handleClose();
    },
    onError: (err: any) => {
      setGlobalError(err.message);
    }
  });

  const handleSubmit = () => {
    if (!transaction) return;
    setSubmitted(true);
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const payload = {
      amount:         parseFloat(values.amount),
      wallet_id:      transaction.type !== 'transfer' && values.wallet_id ? values.wallet_id : undefined,
      source_wallet_id: transaction.type === 'transfer' && values.source_wallet_id ? values.source_wallet_id : undefined,
      destination_wallet_id: transaction.type === 'transfer' && values.destination_wallet_id ? values.destination_wallet_id : undefined,
      category_id:    transaction.type === 'expense' ? (values.category_id || undefined) : undefined,
      payment_method: transaction.type !== 'transfer' ? values.payment_method : undefined,
      note:           values.note.trim() || undefined,
    };

    updateTransactionMutation.mutate(payload);
  };

  const isMutating = updateTransactionMutation.isPending;

  return (
    <BaseModal
      isOpen={isEditTransactionOpen}
      onClose={handleClose}
      title="Edit Transaction"
      maxWidth="lg"
    >
      <div className="flex flex-col gap-5">

        {/* Read-only context row */}
        {transaction && (
          <div className="rounded-lg bg-[var(--color-abyssal-slate)] px-4 py-3 flex items-center gap-3">
            <span
              className="text-xs font-medium text-[var(--color-muted-text)] uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              {TYPE_LABELS[transaction.type] ?? transaction.type}
            </span>
            <span className="text-[var(--color-tactical-border)]" aria-hidden="true">·</span>
            <span
              className="text-xs text-[var(--color-muted-text)] truncate"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              {transaction.wallet_name}
            </span>
            {transaction.is_adjustment_event && (
              <>
                <span className="text-[var(--color-tactical-border)]" aria-hidden="true">·</span>
                <span
                  className="text-xs text-[var(--color-dawn-gold)]"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  Adjustment entry
                </span>
              </>
            )}
          </div>
        )}

        {/* Adjustment notice */}
        {transaction?.is_adjustment_event && (
          <p
            className="text-xs text-[var(--color-muted-text)] leading-relaxed"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Editing this entry will create a new adjustment event. The original transaction record and any HP/XP consequences are preserved.
          </p>
        )}

        {/* Amount */}
        <FormField label="Amount" htmlFor="edit-tx-amount" error={errors.amount} required>
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted-text)]"
              aria-hidden="true"
            >
              Rp
            </span>
            <FormCurrencyInput
              id="edit-tx-amount"
              value={values.amount}
              onChange={(e) => setField('amount', e.target.value)}
              placeholder="0"
              hasError={Boolean(errors.amount)}
              className="pl-9"
              autoComplete="off"
            />
          </div>
        </FormField>

        {/* Wallets */}
        {transaction?.type === 'transfer' ? (
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Source Wallet" htmlFor="edit-tx-source-wallet" error={errors.source_wallet_id} required>
              <FormSelect
                id="edit-tx-source-wallet"
                value={values.source_wallet_id}
                onChange={(e) => setField('source_wallet_id', e.target.value)}
                hasError={Boolean(errors.source_wallet_id)}
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </FormSelect>
            </FormField>
            <FormField label="Destination Wallet" htmlFor="edit-tx-dest-wallet" error={errors.destination_wallet_id} required>
              <FormSelect
                id="edit-tx-dest-wallet"
                value={values.destination_wallet_id}
                onChange={(e) => setField('destination_wallet_id', e.target.value)}
                hasError={Boolean(errors.destination_wallet_id)}
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </FormSelect>
            </FormField>
          </div>
        ) : (
          <FormField label="Wallet" htmlFor="edit-tx-wallet" error={errors.wallet_id} required>
            <FormSelect
              id="edit-tx-wallet"
              value={values.wallet_id}
              onChange={(e) => setField('wallet_id', e.target.value)}
              hasError={Boolean(errors.wallet_id)}
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </FormSelect>
          </FormField>
        )}

        {/* Category — for expense transactions */}
        {transaction?.type === 'expense' && (
          <FormField label="Category" htmlFor="edit-tx-category">
            <FormSelect
              id="edit-tx-category"
              value={values.category_id}
              onChange={(e) => setField('category_id', e.target.value)}
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FormSelect>
          </FormField>
        )}

        {/* Payment Method */}
        {transaction?.type !== 'transfer' && (
          <FormField label="Payment Method" htmlFor="edit-tx-method">
            <FormSelect
              id="edit-tx-method"
              value={values.payment_method}
              onChange={(e) => setField('payment_method', e.target.value as PaymentMethod)}
            >
              {PAYMENT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
              {values.payment_method === 'e_wallet' && (
                <option value="e_wallet">E-Wallet (Legacy)</option>
              )}
              {values.payment_method === 'other' && (
                <option value="other">Other (Legacy)</option>
              )}
            </FormSelect>
          </FormField>
        )}

        {/* Note */}
        <FormField label="Note (Optional)" htmlFor="edit-tx-note">
          <FormTextarea
            id="edit-tx-note"
            value={values.note}
            onChange={(e) => setField('note', e.target.value)}
            placeholder="Add or update a note…"
            maxLength={200}
          />
        </FormField>
      </div>

      <ModalFooter>
        <GhostButton onClick={handleClose} disabled={isMutating}>
          Cancel
        </GhostButton>
        <PrimaryButton
          onClick={handleSubmit}
          disabled={!transaction || isMutating}
          aria-busy={isMutating}
        >
          {isMutating ? 'Saving…' : 'Save Changes'}
        </PrimaryButton>
      </ModalFooter>
    </BaseModal>
  );
}


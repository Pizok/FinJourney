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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BaseModal, FormField, FormInput, FormTextarea, FormSelect,
  ModalFooter, PrimaryButton, GhostButton,
} from './BaseModal';
import { useWalletStore, selectEditTransaction } from '@/components/finance/stores/walletStore';
import type { PaymentMethod } from '@/types/wallet.types';

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

interface FormValues {
  amount: string;
  category_id: string;
  payment_method: PaymentMethod;
  note: string;
}

interface FormErrors {
  amount?: string;
}

function validate(v: FormValues): FormErrors {
  const e: FormErrors = {};
  const n = parseFloat(v.amount);
  if (v.amount.trim() === '' || isNaN(n)) {
    e.amount = 'Amount is required.';
  } else if (n <= 0) {
    e.amount = 'Amount must be greater than 0.';
  }
  return e;
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',        label: 'Cash' },
  { value: 'debit_card',  label: 'Debit Card' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'transfer',    label: 'Transfer' },
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
        category_id:    transaction.category_id ?? '',
        payment_method: transaction.payment_method,
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
      if (!transaction) throw new Error('No transaction selected');
      const response = await fetch(`/api/v1/transactions/${transaction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to update transaction');
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'bootstrap'] });
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
      category_id:    values.category_id || undefined,
      payment_method: values.payment_method,
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
            <FormInput
              id="edit-tx-amount"
              type="number"
              value={values.amount}
              onChange={(e) => setField('amount', e.target.value)}
              placeholder="0"
              hasError={Boolean(errors.amount)}
              min={0}
              step={1000}
              className="pl-9"
              autoComplete="off"
            />
          </div>
        </FormField>

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
        <FormField label="Payment Method" htmlFor="edit-tx-method">
          <FormSelect
            id="edit-tx-method"
            value={values.payment_method}
            onChange={(e) => setField('payment_method', e.target.value as PaymentMethod)}
          >
            {PAYMENT_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </FormSelect>
        </FormField>

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


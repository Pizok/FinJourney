'use client';

// =============================================================================
// components/wallet/modals/AddTransactionModal.tsx — FinJourney
//
// Modal for adding a new transaction (income, expense, or transfer).
//
// Fields (per wallet_data_contract.md):
//   Type | Amount | Wallet | Category (if expense) | Payment Method | Note | Date
//
// CTAs: "Add Transaction" | "Cancel"
//
// Mutations:
//   Optimistic: optimisticAddTransaction() is called with a temp ID.
//   Real API mutation is drafted and commented out for Part 2.
//
// Validation:
//   - Amount: required, must be > 0
//   - Wallet: required
//   - Category: required for expense type
//   - Payment method: required
//   - Date: required, not in the future
// =============================================================================

import { useState, useCallback } from 'react';
import { CheckCircle2, ChevronDown, Save } from 'lucide-react';
import { apiFetchClient } from '@/lib/apiClient.client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BaseModal, FormField, FormInput, FormCurrencyInput, FormTextarea, FormSelect,
  ModalFooter, PrimaryButton, GhostButton,
} from '@/components/shared/modals/BaseModal';
import type { Wallet, Category, TransactionType, PaymentMethod } from '@/types/wallet.types';

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

interface FormValues {
  type: TransactionType;
  amount: string;
  wallet_id: string;
  source_wallet_id: string;
  destination_wallet_id: string;
  category_id: string;
  payment_method: PaymentMethod;
  note: string;
  transaction_date: string;
}

interface FormErrors {
  amount?: string;
  wallet_id?: string;
  source_wallet_id?: string;
  destination_wallet_id?: string;
  category_id?: string;
  payment_method?: string;
  transaction_date?: string;
}

// Today's date in YYYY-MM-DD (local timezone)
function todayDateStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function defaultValues(): FormValues {
  return {
    type: 'expense',
    amount: '',
    wallet_id: '',
    source_wallet_id: '',
    destination_wallet_id: '',
    category_id: '',
    payment_method: 'cash',
    note: '',
    transaction_date: todayDateStr(),
  };
}

function validate(v: FormValues): FormErrors {
  const e: FormErrors = {};
  const n = parseFloat(v.amount);
  if (v.amount.trim() === '' || isNaN(n)) {
    e.amount = 'Amount is required.';
  } else if (n <= 0) {
    e.amount = 'Amount must be greater than 0.';
  }
  if (v.type === 'transfer') {
    if (!v.source_wallet_id) e.source_wallet_id = 'Please select a source wallet.';
    if (!v.destination_wallet_id) e.destination_wallet_id = 'Please select a destination wallet.';
    if (v.source_wallet_id && v.destination_wallet_id && v.source_wallet_id === v.destination_wallet_id) {
      e.destination_wallet_id = 'Source and destination must be different.';
    }
  } else {
    if (!v.wallet_id) {
      e.wallet_id = 'Please select a wallet.';
    }
    if (v.type === 'expense' && !v.category_id) {
      e.category_id = 'Category is required for expenses.';
    }
    if (!v.payment_method) {
      e.payment_method = 'Payment method is required.';
    }
  }
  if (!v.transaction_date) {
    e.transaction_date = 'Date is required.';
  } else if (new Date(v.transaction_date) > new Date(todayDateStr())) {
    e.transaction_date = 'Date cannot be in the future.';
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

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'expense',  label: 'Expense' },
  { value: 'income',   label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
];

// ---------------------------------------------------------------------------
// AddTransactionModal
// ---------------------------------------------------------------------------

export function TransactionModalForm({ wallets, categories, isOpen, onClose, onSuccess }: { wallets: Wallet[]; categories: Category[]; isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [values, setValues] = useState<FormValues>(defaultValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const handleClose = useCallback(() => {
    setValues(defaultValues());
    setErrors({});
    setSubmitted(false);
    setGlobalError(null);
    onClose();
  }, [onClose]);

  const setField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      // Reset category when switching away from expense
      if (key === 'type' && value !== 'expense') {
        next.category_id = '';
      }
      if (submitted) setErrors(validate(next));
      return next;
    });
  };

  const queryClient = useQueryClient();

  const addTransactionMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiFetchClient('transactions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (_, variables: any) => {
      if (variables.type === 'income') {
        queryClient.invalidateQueries({ queryKey: ['analytics'] });
      }
      onSuccess();
      handleClose();
    },
    onError: (err: any) => {
      // rollback is handled automatically if we don't optimistically update,
      // but since we want consistency, we'll just invalidate instead of custom rolling back.
      setGlobalError(err.message);
    }
  });

  const handleSubmit = () => {
    setSubmitted(true);
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const payload = {
      type: values.type,
      amount: parseFloat(values.amount),
      wallet_id: values.type === 'transfer' ? undefined : values.wallet_id,
      source_wallet_id: values.type === 'transfer' ? values.source_wallet_id : undefined,
      destination_wallet_id: values.type === 'transfer' ? values.destination_wallet_id : undefined,
      category_id: values.type === 'expense' ? (values.category_id || undefined) : undefined,
      payment_method: values.type === 'transfer' ? undefined : values.payment_method,
      note: values.note.trim() || undefined,
      transaction_date: values.transaction_date,
    };

    addTransactionMutation.mutate(payload);
  };

  const isMutating = addTransactionMutation.isPending;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Transaction"
      maxWidth="lg"
    >
      <div className="flex flex-col gap-5">
        {globalError && (
          <p className="font-sans text-sm text-[var(--color-terracotta)] mb-4 bg-[var(--color-terracotta)]/10 border border-[var(--color-terracotta)]/20 rounded-lg px-3 py-2" role="alert">
            {globalError}
          </p>
        )}

        {/* Type selector */}
        <div className="flex flex-col gap-1.5">
          <span
            className="text-sm font-medium text-[var(--color-pearl-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Type
          </span>
          <div
            role="radiogroup"
            aria-label="Transaction type"
            className="flex gap-2"
          >
            {TYPE_OPTIONS.map(({ value, label }) => {
              const isSelected = values.type === value;
              const colorVar =
                value === 'income' ? 'var(--color-muted-emerald)'
                : value === 'expense' ? 'var(--color-terracotta)'
                : 'var(--color-steel-violet)';
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setField('type', value)}
                  className={[
                    'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                    'focus-visible:outline-[var(--color-muted-emerald)]',
                    'cursor-pointer',
                  ].join(' ')}
                  style={{
                    borderColor: isSelected ? colorVar : 'var(--color-tactical-border)',
                    backgroundColor: isSelected ? `${colorVar}18` : 'transparent',
                    color: isSelected ? colorVar : 'var(--color-muted-text)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Amount */}
        <FormField label="Amount" htmlFor="tx-amount" error={errors.amount} required>
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted-text)]"
              aria-hidden="true"
            >
              Rp
            </span>
            <FormCurrencyInput
              id="tx-amount"
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
        {values.type === 'transfer' ? (
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Source Wallet" htmlFor="tx-source-wallet" error={errors.source_wallet_id} required>
              <FormSelect
                id="tx-source-wallet"
                value={values.source_wallet_id}
                onChange={(e) => setField('source_wallet_id', e.target.value)}
                hasError={Boolean(errors.source_wallet_id)}
              >
                <option value="">Select source…</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </FormSelect>
            </FormField>
            <FormField label="Destination Wallet" htmlFor="tx-dest-wallet" error={errors.destination_wallet_id} required>
              <FormSelect
                id="tx-dest-wallet"
                value={values.destination_wallet_id}
                onChange={(e) => setField('destination_wallet_id', e.target.value)}
                hasError={Boolean(errors.destination_wallet_id)}
              >
                <option value="">Select destination…</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </FormSelect>
            </FormField>
          </div>
        ) : (
          <FormField label="Wallet" htmlFor="tx-wallet" error={errors.wallet_id} required>
            <FormSelect
              id="tx-wallet"
              value={values.wallet_id}
              onChange={(e) => setField('wallet_id', e.target.value)}
              hasError={Boolean(errors.wallet_id)}
            >
              <option value="">Select a wallet…</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </FormSelect>
          </FormField>
        )}

        {/* Category — only for expenses */}
        {values.type === 'expense' && (
          <FormField label="Category" htmlFor="tx-category" error={errors.category_id} required>
            <FormSelect
              id="tx-category"
              value={values.category_id}
              onChange={(e) => setField('category_id', e.target.value)}
              hasError={Boolean(errors.category_id)}
            >
              <option value="">Select a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FormSelect>
          </FormField>
        )}

        {/* Payment Method */}
        {values.type !== 'transfer' && (
          <FormField label="Payment Method" htmlFor="tx-method" error={errors.payment_method} required>
            <FormSelect
              id="tx-method"
              value={values.payment_method}
              onChange={(e) => setField('payment_method', e.target.value as PaymentMethod)}
              hasError={Boolean(errors.payment_method)}
            >
              {PAYMENT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </FormSelect>
          </FormField>
        )}

        {/* Date */}
        <FormField label="Date" htmlFor="tx-date" error={errors.transaction_date} required>
          <FormInput
            id="tx-date"
            type="date"
            value={values.transaction_date}
            onChange={(e) => setField('transaction_date', e.target.value)}
            hasError={Boolean(errors.transaction_date)}
            max={todayDateStr()}
          />
        </FormField>

        {/* Note (Optional) */}
        <FormField label="Note (Optional)" htmlFor="tx-note">
          <FormTextarea
            id="tx-note"
            value={values.note}
            onChange={(e) => setField('note', e.target.value)}
            placeholder="e.g. Lunch with colleagues"
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
          disabled={isMutating}
          aria-busy={isMutating}
        >
          {isMutating ? 'Adding…' : 'Add Transaction'}
        </PrimaryButton>
      </ModalFooter>
    </BaseModal>
  );
}


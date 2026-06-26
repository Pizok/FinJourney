'use client';

import { X } from 'lucide-react';
import { useTransactionModal } from '../hooks/useTransactionModal';
import type { TransactionType } from '../types/dashboard.types';

interface AddTransactionModalProps {
  onClose: () => void;
}

// ─── Transaction Type Selector ─────────────────────────────────────────────────

const TYPES: { value: TransactionType; label: string }[] = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'transfer', label: 'Transfer' },
];

// ─── Field Components ──────────────────────────────────────────────────────────

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block font-sans text-xs uppercase tracking-widest text-muted-text mb-1.5"
    >
      {children}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="font-sans text-xs text-terracotta mt-1" role="alert">
      {message}
    </p>
  );
}

const inputBase =
  'w-full px-3 py-2.5 rounded-lg bg-abyssal-slate border border-tactical-border text-pearl-text font-sans text-sm placeholder:text-muted-text transition-colors focus:outline-none focus:border-muted-emerald';

// ─── Modal ─────────────────────────────────────────────────────────────────────

export function AddTransactionModal({ onClose }: AddTransactionModalProps) {
  const {
    form,
    errors,
    isSubmitting,
    wallets,
    expenseCategories,
    incomeCategories,
    setType,
    setField,
    submit,
  } = useTransactionModal();

  const categories =
    form.type === 'income' ? incomeCategories : expenseCategories;
  const showCategory = form.type !== 'transfer';

  return (
    <div className="bg-canvas-surface border border-tactical-border rounded-xl p-8 w-full max-w-lg shadow-xl animate-fade-in max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-lg font-semibold text-pearl-text">
          Add Transaction
        </h2>
        <button
          onClick={onClose}
          className="text-muted-text hover:text-pearl-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-border rounded"
          type="button"
          aria-label="Close modal"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      {/* General Error */}
      {errors.general && (
        <p className="font-sans text-sm text-terracotta mb-4 bg-terracotta/10 border border-terracotta/20 rounded-lg px-3 py-2">
          {errors.general}
        </p>
      )}

      <div className="space-y-5">
        {/* Transaction Type */}
        <div>
          <FieldLabel htmlFor="tx-type">Transaction Type</FieldLabel>
          <div
            className="flex rounded-lg border border-tactical-border overflow-hidden"
            role="group"
            aria-label="Transaction type"
          >
            {TYPES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setType(value)}
                type="button"
                className={[
                  'flex-1 py-2.5 font-sans text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-muted-emerald',
                  form.type === value
                    ? 'bg-muted-emerald text-abyssal-slate'
                    : 'bg-transparent text-muted-text hover:text-pearl-text hover:bg-abyssal-slate/40',
                ].join(' ')}
                aria-pressed={form.type === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <FieldLabel htmlFor="tx-amount">Amount</FieldLabel>
          <input
            id="tx-amount"
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={form.amount ? Number(String(form.amount).replace(/\D/g, '')).toLocaleString('id-ID') : ''}
            onChange={(e) => setField('amount', e.target.value.replace(/\D/g, ''))}
            className={inputBase}
            aria-describedby={errors.amount ? 'amount-error' : undefined}
          />
          <FieldError message={errors.amount} />
        </div>

        {/* Category */}
        {showCategory && (
          <div>
            <FieldLabel htmlFor="tx-category">Category</FieldLabel>
            <select
              id="tx-category"
              value={form.category_id}
              onChange={(e) => setField('category_id', e.target.value)}
              className={inputBase}
            >
              <option value="" disabled>
                Select category
              </option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <FieldError message={errors.category_id} />
          </div>
        )}

        {/* Wallet */}
        <div>
          <FieldLabel htmlFor="tx-wallet">Wallet</FieldLabel>
          <select
            id="tx-wallet"
            value={form.wallet_id}
            onChange={(e) => setField('wallet_id', e.target.value)}
            className={inputBase}
          >
            <option value="" disabled>
              Select wallet
            </option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <FieldError message={errors.wallet_id} />
        </div>

        {/* Note */}
        <div>
          <FieldLabel htmlFor="tx-note">Note</FieldLabel>
          <input
            id="tx-note"
            type="text"
            placeholder="Optional description"
            value={form.note}
            onChange={(e) => setField('note', e.target.value)}
            className={inputBase}
          />
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex gap-3 mt-8">
        <button
          onClick={onClose}
          type="button"
          className="flex-1 flex items-center justify-center px-4 py-2.5 rounded-lg bg-transparent border border-tactical-border text-muted-text font-sans text-sm font-medium transition-colors hover:border-pearl-text hover:text-pearl-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-border focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface"
        >
          Cancel
        </button>

        <button
          onClick={submit}
          disabled={isSubmitting}
          type="button"
          className="flex-1 flex items-center justify-center px-4 py-2.5 rounded-lg bg-muted-emerald text-abyssal-slate font-sans text-sm font-medium transition-colors hover:bg-muted-emerald/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-emerald focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface"
        >
          {isSubmitting ? 'Saving…' : 'Save Transaction'}
        </button>
      </div>
    </div>
  );
}

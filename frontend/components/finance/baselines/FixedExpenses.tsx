'use client';

// =============================================================================
// components/wallet/baselines/FixedExpenses.tsx
//
// Full-width list of recurring fixed costs (rent, internet, gym, etc.).
// Reads from walletStore.fixedExpenses.
//
// Each row: name | amount (Rp formatted) | due day badge | remove button
// Footer: "Add Fixed Expense" button (UI-only in this phase — modal deferred).
// Empty state: friendly prompt to add the first expense.
//
// Design: Canvas Surface card, Tactical Border dividers. Flat surface only.
// =============================================================================

import { useState } from 'react';
import { Calendar, PlusCircle, Receipt, Trash2 } from 'lucide-react';
import { useWalletStore } from '@/components/finance/stores/walletStore';
import type { FixedExpense } from '@/types/wallet.types';
import { AddFixedExpenseModal } from '@/components/finance/modals/AddFixedExpenseModal';
import { toast } from 'sonner';

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

// ─── Recurrence label formatter ───────────────────────────────────────────────

function recurrenceLabel(expense: FixedExpense): string {
  switch (expense.recurrence_type) {
    case 'daily':
      return 'Every day';
    case 'weekly':
      return expense.recurrence_value
        ? `Every ${expense.recurrence_value}`
        : 'Weekly';
    case 'monthly': {
      const v = expense.recurrence_value;
      if (v === 'last') return 'Last day of month';
      if (typeof v === 'number') {
        const suffix = (() => {
          if (v % 10 === 1 && v !== 11) return 'st';
          if (v % 10 === 2 && v !== 12) return 'nd';
          if (v % 10 === 3 && v !== 13) return 'rd';
          return 'th';
        })();
        return `${v}${suffix} of the month`;
      }
      return 'Monthly';
    }
    case 'yearly': {
      const v = String(expense.recurrence_value ?? '');
      if (v.includes('-')) {
        const [mm, dd] = v.split('-');
        const date = new Date(2000, parseInt(mm, 10) - 1, parseInt(dd, 10));
        return `Yearly on ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
      }
      return 'Yearly';
    }
    default:
      return 'Recurring';
  }
}

// ─── ExpenseRow ───────────────────────────────────────────────────────────────

function ExpenseRow({
  expense,
  onRemove,
}: {
  expense: FixedExpense;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-4 py-3.5">
      {/* Icon vessel */}
      <div
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-abyssal-slate)]"
      >
        <Receipt
          size={15}
          strokeWidth={2}
          className="text-[var(--color-muted-text)]"
        />
      </div>

      {/* Name + recurrence */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-medium text-[var(--color-pearl-text)]"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {expense.name}
        </p>
        <p
          className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-muted-text)]"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          <Calendar size={10} strokeWidth={2} aria-hidden="true" />
          {recurrenceLabel(expense)}
        </p>
      </div>

      {/* Amount */}
      <span
        className="shrink-0 tabular-nums text-sm font-medium text-[var(--color-pearl-text)]"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {formatRupiah(expense.amount)}
      </span>

      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(expense.id)}
        aria-label={`Remove ${expense.name}`}
        className={[
          'shrink-0 rounded-md p-1.5 text-[var(--color-muted-text)]',
          'transition-colors duration-150',
          'hover:bg-[var(--color-terracotta)]/10 hover:text-[var(--color-terracotta)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-muted-emerald)]',
        ].join(' ')}
      >
        <Trash2 size={13} strokeWidth={2} />
      </button>
    </div>
  );
}


// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyExpenses({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div
        aria-hidden="true"
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-abyssal-slate)] text-[var(--color-muted-text)]"
      >
        <Receipt size={20} strokeWidth={2} />
      </div>
      <p
        className="mb-1 text-sm font-medium text-[var(--color-pearl-text)]"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        No fixed expenses yet
      </p>
      <p
        className="mb-5 max-w-[240px] text-xs leading-relaxed text-[var(--color-muted-text)]"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        Add rent, internet, or other recurring bills to refine your daily
        budget.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className={[
          'flex items-center gap-2 rounded-lg border border-[var(--color-muted-emerald)] px-4 py-2',
          'text-sm font-medium text-[var(--color-muted-emerald)]',
          'transition-colors duration-150 hover:bg-[var(--color-muted-emerald)]/10',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-muted-emerald)]',
        ].join(' ')}
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        <PlusCircle size={14} strokeWidth={2} aria-hidden="true" />
        Add Fixed Expense
      </button>
    </div>
  );
}

// ─── FixedExpenses ────────────────────────────────────────────────────────────

export function FixedExpenses() {
  const fixedExpenses = useWalletStore((s) => s.fixedExpenses);
  const removeFixedExpense = useWalletStore((s) => s.removeFixedExpense);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const totalMonthly = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);

  function handleRemove(id: string) {
    removeFixedExpense(id);
    toast.success('Fixed expense removed.');
  }

  return (
    <>
      <div
        className="rounded-xl border border-[var(--color-tactical-border)] bg-[var(--color-canvas-surface)]"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-tactical-border)] px-6 py-4">
          <div>
            <h2
              className="text-[15px] font-semibold text-[var(--color-pearl-text)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Fixed Expenses
            </h2>
            {fixedExpenses.length > 0 && (
              <p className="mt-0.5 text-xs text-[var(--color-muted-text)]">
                {formatRupiah(totalMonthly)} / month total
              </p>
            )}
          </div>

          {fixedExpenses.length > 0 && (
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className={[
                'flex items-center gap-1.5 rounded-lg border border-[var(--color-tactical-border)] px-3 py-1.5',
                'text-xs font-medium text-[var(--color-pearl-text)]',
                'transition-colors duration-150 hover:border-[var(--color-muted-emerald)]/50 hover:text-[var(--color-muted-emerald)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-muted-emerald)]',
              ].join(' ')}
            >
              <PlusCircle size={12} strokeWidth={2} aria-hidden="true" />
              Add
            </button>
          )}
        </div>

        {/* List */}
        <div className="px-6">
          {fixedExpenses.length === 0 ? (
            <EmptyExpenses onAdd={() => setIsAddOpen(true)} />
          ) : (
            <div>
              {fixedExpenses.map((expense, idx) => (
                <div key={expense.id}>
                  <ExpenseRow expense={expense} onRemove={handleRemove} />
                  {idx < fixedExpenses.length - 1 && (
                    <div
                      className="border-t border-[var(--color-tactical-border)]/50"
                      aria-hidden="true"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer summary when list has items */}
        {fixedExpenses.length > 0 && (
          <div className="border-t border-[var(--color-tactical-border)]/50 px-6 py-3">
            <p className="text-xs text-[var(--color-muted-text)]">
              {fixedExpenses.length} expense{fixedExpenses.length !== 1 ? 's' : ''} ·{' '}
              Included in fixed cost deduction for the daily budget.
            </p>
          </div>
        )}
      </div>

      {/* Add Fixed Expense Modal */}
      <AddFixedExpenseModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
      />
    </>
  );
}



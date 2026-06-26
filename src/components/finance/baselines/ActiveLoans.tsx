'use client';

// =============================================================================
// components/wallet/baselines/ActiveLoans.tsx
//
// Full-width list of active debts tracked on the Baselines & Debt tab.
//
// Each loan row:
//   • Name + next due date
//   • Progress bar: paid_amount / total_amount (muted-emerald fill growing as paid off)
//   • Remaining balance in text-terracotta (Coral Danger) to distinguish debt
//     from asset balances — the empty track paired with the terracotta label
//     creates a clear visual signal of outstanding debt.
//   • Monthly installment label
//
// Empty state: celebratory — "No active loans. Great work!"
// =============================================================================

import { useState } from 'react';
import { CalendarClock, PlusCircle, TrendingDown } from 'lucide-react';
import { useWalletStore } from '@/components/finance/stores/walletStore';
import { Progress } from '@/components/ui/Progress';
import type { Loan } from '@/types/wallet.types';
import { AddLoanModal } from '@/components/finance/modals/AddLoanModal';
import { toast } from 'sonner';

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

function formatDueDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── LoanRow ──────────────────────────────────────────────────────────────────

function LoanRow({ loan }: { loan: Loan }) {
  const remaining = loan.total_amount - loan.paid_amount;
  const progressPct = loan.total_amount > 0
    ? Math.min(100, Math.round((loan.paid_amount / loan.total_amount) * 100))
    : 0;

  return (
    <div className="py-4">
      {/* Top row: name + remaining balance */}
      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className="truncate text-sm font-medium text-[var(--color-pearl-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {loan.name}
          </p>
          <p
            className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-muted-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            <CalendarClock size={10} strokeWidth={2} aria-hidden="true" />
            Next due: {formatDueDate(loan.next_due_date)}
          </p>
        </div>

        {/* Remaining balance — Coral Danger palette */}
        <div className="shrink-0 text-right">
          <p
            className="tabular-nums text-sm font-semibold text-[var(--color-terracotta)]"
            style={{ fontFamily: 'var(--font-sans)' }}
            aria-label={`${formatRupiah(remaining)} remaining`}
          >
            {formatRupiah(remaining)}
          </p>
          <p
            className="text-[11px] text-[var(--color-muted-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            remaining
          </p>
        </div>
      </div>

      {/* Progress bar: muted-emerald fill = amount paid */}
      <Progress
        value={loan.paid_amount}
        max={loan.total_amount}
        colorVar="--color-muted-emerald"
        height="sm"
        aria-label={`${loan.name}: ${progressPct}% paid off`}
      />

      {/* Bottom row: paid vs total + monthly installment */}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p
          className="text-xs tabular-nums text-[var(--color-muted-text)]"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {formatRupiah(loan.paid_amount)} of {formatRupiah(loan.total_amount)} paid ({progressPct}%)
        </p>
        <p
          className="shrink-0 text-xs tabular-nums text-[var(--color-muted-text)]"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {formatRupiah(loan.monthly_installment)}/mo
        </p>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyLoans({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div
        aria-hidden="true"
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-muted-emerald)]/10 text-[var(--color-muted-emerald)]"
      >
        <TrendingDown size={20} strokeWidth={2} />
      </div>
      <p
        className="mb-1 text-sm font-medium text-[var(--color-pearl-text)]"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        No active loans
      </p>
      <p
        className="mb-5 max-w-[220px] text-xs leading-relaxed text-[var(--color-muted-text)]"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        Great work! If you take on a loan in the future, track it here.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className={[
          'flex items-center gap-2 rounded-lg border border-[var(--color-tactical-border)] px-4 py-2',
          'text-xs font-medium text-[var(--color-pearl-text)]',
          'transition-colors duration-150 hover:border-[var(--color-pearl-text)]/30',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-muted-emerald)]',
        ].join(' ')}
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        <PlusCircle size={13} strokeWidth={2} aria-hidden="true" />
        Add Loan
      </button>
    </div>
  );
}

// ─── ActiveLoans ──────────────────────────────────────────────────────────────

export function ActiveLoans() {
  const loans = useWalletStore((s) => s.loans);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const totalRemaining = loans.reduce(
    (sum, l) => sum + (l.total_amount - l.paid_amount),
    0,
  );
  const totalMonthlyInstallments = loans.reduce(
    (sum, l) => sum + l.monthly_installment,
    0,
  );

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
            Active Loans
          </h2>
          {loans.length > 0 && (
            <p className="mt-0.5 text-xs text-[var(--color-muted-text)]">
              <span className="text-[var(--color-terracotta)]">
                {formatRupiah(totalRemaining)}
              </span>{' '}
              outstanding · {formatRupiah(totalMonthlyInstallments)}/mo installments
            </p>
          )}
        </div>

        {loans.length > 0 && (
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
        {loans.length === 0 ? (
          <EmptyLoans onAdd={() => setIsAddOpen(true)} />
        ) : (
          <div>
            {loans.map((loan, idx) => (
              <div key={loan.id}>
                <LoanRow loan={loan} />
                {idx < loans.length - 1 && (
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

      {/* Footer note */}
      {loans.length > 0 && (
        <div className="border-t border-[var(--color-tactical-border)]/50 px-6 py-3">
          <p className="text-xs text-[var(--color-muted-text)]">
            {loans.length} active loan{loans.length !== 1 ? 's' : ''} ·{' '}
            Monthly installments are included in fixed cost deduction.
          </p>
        </div>
      )}
      </div>

      {/* Add Loan Modal */}
      <AddLoanModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
      />
    </>
  );
}



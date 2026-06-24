'use client';

// =============================================================================
// components/wallet/baselines/FinancialAssumptionsCard.tsx
//
// Displays and edits Expected Monthly Income and Monthly Savings Target.
// Lives on the Baselines & Debt tab. Reads/writes the walletStore (NOT
// the settingsStore) to keep the Wallet and Settings domains cleanly separated.
//
// Shows a live "Projected Safe Daily Budget" preview that recalculates
// instantly as the user edits — backend value is authoritative on save.
//
// Formula (from logic.md):
//   projected_safe_daily_budget = (income − fixed_costs_total − savings) / 30
//   fixed_costs_total = sum(fixed_expenses[].amount) + sum(loans[].monthly_installment)
// =============================================================================

import { useId } from 'react';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { useWalletStore } from '@/components/finance/stores/walletStore';

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

function parseDigits(raw: string): number {
  const digitsOnly = raw.replace(/[^\d]/g, '');
  return digitsOnly === '' ? 0 : parseInt(digitsOnly, 10);
}

// ─── CurrencyInput ────────────────────────────────────────────────────────────

interface CurrencyInputProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
  hasError?: boolean;
  'aria-describedby'?: string;
}

function CurrencyInput({
  id,
  value,
  onChange,
  hasError = false,
  'aria-describedby': ariaDescribedBy,
}: CurrencyInputProps) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-sans text-sm text-[var(--color-muted-text)]"
      >
        Rp
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value.toLocaleString('id-ID')}
        onChange={(e) => onChange(parseDigits(e.target.value))}
        aria-describedby={ariaDescribedBy}
        aria-invalid={hasError ? true : undefined}
        className={[
          'w-full rounded-lg border bg-[var(--color-abyssal-slate)] py-2.5 pl-9 pr-3',
          'font-sans text-sm tabular-nums text-[var(--color-pearl-text)]',
          'transition-colors duration-150',
          'focus:outline-none focus:ring-1',
          hasError
            ? 'border-[var(--color-terracotta)] ring-1 ring-[var(--color-terracotta)]/20'
            : 'border-[var(--color-tactical-border)] focus:border-[var(--color-muted-emerald)]/60 focus:ring-[var(--color-muted-emerald)]/30',
        ].join(' ')}
      />
    </div>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block font-sans text-xs font-medium text-[var(--color-muted-text)]"
    >
      {children}
    </label>
  );
}

// ─── Savings Validation ───────────────────────────────────────────────────────

function computeTotalFixed(fixedExpenses: { amount: number }[], loans: { monthly_installment: number }[]): number {
  return (
    fixedExpenses.reduce((s, e) => s + e.amount, 0) +
    loans.reduce((s, l) => s + l.monthly_installment, 0)
  );
}

// ─── FinancialAssumptionsCard ─────────────────────────────────────────────────

export function FinancialAssumptionsCard() {
  const financialAssumptions = useWalletStore((s) => s.financialAssumptions);
  const fixedExpenses = useWalletStore((s) => s.fixedExpenses);
  const loans = useWalletStore((s) => s.loans);
  const updateFinancialAssumptions = useWalletStore((s) => s.updateFinancialAssumptions);

  const incomeId = useId();
  const savingsId = useId();
  const savingsErrorId = useId();

  const totalFixed = computeTotalFixed(fixedExpenses, loans);
  const available = financialAssumptions.expected_monthly_income - totalFixed;
  const savingsExceedsAvailable = financialAssumptions.monthly_savings_target > available;
  const savingsError = savingsExceedsAvailable
    ? `Exceeds available. After fixed costs: ${formatRupiah(Math.max(0, available))}`
    : null;

  return (
    <div
      className="rounded-xl border border-[var(--color-tactical-border)] bg-[var(--color-canvas-surface)]"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-[var(--color-tactical-border)] px-6 py-5">
        <div
          aria-hidden="true"
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-muted-emerald)]/10"
        >
          <TrendingUp
            className="text-[var(--color-muted-emerald)]"
            size={15}
            strokeWidth={2}
          />
        </div>
        <div>
          <h2
            className="font-display text-[15px] font-semibold text-[var(--color-pearl-text)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Financial Assumptions
          </h2>
          <p className="mt-0.5 text-sm text-[var(--color-muted-text)]">
            Powers the Projected Safe Daily Budget calculation.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-6 px-6 py-5">
        {/* Income + Savings inputs — two columns on sm+ */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Income */}
          <div>
            <FieldLabel htmlFor={incomeId}>Expected Monthly Income</FieldLabel>
            <CurrencyInput
              id={incomeId}
              value={financialAssumptions.expected_monthly_income}
              onChange={(expected_monthly_income) =>
                updateFinancialAssumptions({ expected_monthly_income })
              }
            />
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-muted-text)]">
              Your baseline gross income for the month.
            </p>
          </div>

          {/* Savings */}
          <div>
            <FieldLabel htmlFor={savingsId}>Monthly Savings Target</FieldLabel>
            <CurrencyInput
              id={savingsId}
              value={financialAssumptions.monthly_savings_target}
              onChange={(monthly_savings_target) =>
                updateFinancialAssumptions({ monthly_savings_target })
              }
              hasError={!!savingsError}
              aria-describedby={savingsError ? savingsErrorId : undefined}
            />
            {savingsError ? (
              <p
                id={savingsErrorId}
                role="alert"
                className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-[var(--color-terracotta)]"
              >
                <AlertTriangle className="mt-0.5 shrink-0" size={12} strokeWidth={2} aria-hidden="true" />
                <span>{savingsError}</span>
              </p>
            ) : (
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-muted-text)]">
                Deducted before discretionary spending is calculated.
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-[var(--color-tactical-border)]/60" aria-hidden="true" />

        {/* Projected Daily Budget — read-only hero metric */}
        <div className="rounded-lg border border-[var(--color-tactical-border)] bg-[var(--color-abyssal-slate)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted-text)]">
            Projected Safe Daily Budget
          </p>
          <p
            className="mt-1.5 text-2xl font-semibold tabular-nums text-[var(--color-muted-emerald)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {formatRupiah(financialAssumptions.projected_safe_daily_budget)}
            <span className="ml-1.5 font-sans text-sm font-normal text-[var(--color-muted-text)]">
              / day
            </span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted-text)]">
            (Income − Fixed Costs − Savings) ÷ 30. Recalculates instantly as you
            edit. Fixed costs include your expenses and loan installments below.
          </p>
        </div>
      </div>
    </div>
  );
}


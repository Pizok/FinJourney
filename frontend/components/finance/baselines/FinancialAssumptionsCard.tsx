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

import { useId, useState } from 'react';
import { AlertTriangle, TrendingUp, Plus, Trash2, PiggyBank } from 'lucide-react';
import { useWalletStore } from '@/components/finance/stores/walletStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetchClient } from '@/lib/apiClient.client';
import { LogSavingsModal } from '../modals/LogSavingsModal';

export interface IncomeStream {
  id: string;
  name: string;
  amount: number;
}

export interface SavingsTarget {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number;
  deadline: string;
}

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
  
  const queryClient = useQueryClient();

  const { data: incomeStreams = [] } = useQuery<IncomeStream[]>({
    queryKey: ['income_streams'],
    queryFn: () => apiFetchClient<IncomeStream[]>('income-streams/'),
  });

  const { data: savingsTargets = [] } = useQuery<SavingsTarget[]>({
    queryKey: ['savings_targets'],
    queryFn: () => apiFetchClient<SavingsTarget[]>('savings-targets/'),
  });

  const [selectedTarget, setSelectedTarget] = useState<SavingsTarget | null>(null);
  const [isLogSavingsOpen, setIsLogSavingsOpen] = useState(false);

  const openLogSavings = (target: SavingsTarget) => {
    setSelectedTarget(target);
    setIsLogSavingsOpen(true);
  };

  const totalFixed = computeTotalFixed(fixedExpenses, loans);
  const totalIncome = incomeStreams.reduce((s, i) => s + i.amount, 0);
  const totalSavings = savingsTargets.reduce((s, t) => s + t.monthly_contribution, 0);

  const available = totalIncome - totalFixed;
  const savingsExceedsAvailable = totalSavings > available;
  const savingsError = savingsExceedsAvailable
    ? `Exceeds available. After fixed costs: ${formatRupiah(Math.max(0, available))}`
    : null;

  // Real projected budget using actual lists
  const projectedDailyBudget = Math.max(0, (totalIncome - totalFixed - totalSavings) / 30);
  return (
    <div
      className="rounded-xl border border-[var(--color-tactical-border)] bg-[var(--color-canvas-surface)] flex flex-col h-full"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-[var(--color-tactical-border)] px-6 py-5 shrink-0">
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
            Income & Savings
          </h2>
          <p className="mt-0.5 text-sm text-[var(--color-muted-text)]">
            Powers the Projected Safe Daily Budget calculation.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 px-6 py-5">
        
        {/* Layout: Vertical split for desktop, simple stack for mobile */}
        <div className="flex flex-col gap-6 lg:flex-row flex-1">
          {/* Income Column */}
          <div className="flex-1 border-r-0 lg:border-r border-[var(--color-tactical-border)]/60 pr-0 lg:pr-6 pb-6 lg:pb-0 border-b lg:border-b-0">
            <h3 className="font-display text-sm font-semibold text-[var(--color-pearl-text)] mb-3">Income Streams</h3>
            <div className="space-y-3">
              {incomeStreams.map((stream) => (
                <div key={stream.id} className="flex justify-between items-center p-3 rounded-lg border border-[var(--color-tactical-border)] bg-[var(--color-abyssal-slate)]">
                  <div>
                    <p className="text-sm text-[var(--color-pearl-text)]">{stream.name}</p>
                    <p className="text-xs text-[var(--color-muted-text)]">{formatRupiah(stream.amount)} / month</p>
                  </div>
                </div>
              ))}
              {incomeStreams.length === 0 && (
                <p className="text-xs text-[var(--color-muted-text)] italic">No income streams found.</p>
              )}
            </div>
          </div>

          {/* Savings Column */}
          <div className="flex-1 lg:pl-6 pb-6 lg:pb-0">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-display text-sm font-semibold text-[var(--color-pearl-text)]">Savings Targets</h3>
            </div>
            
            <div className="space-y-3">
              {savingsTargets.map((target) => {
                const progressPct = target.target_amount > 0 ? (target.current_amount / target.target_amount) * 100 : 0;
                return (
                  <div key={target.id} className="p-3 rounded-lg border border-[var(--color-tactical-border)] bg-[var(--color-abyssal-slate)]">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-pearl-text)]">{target.name}</p>
                        <p className="text-xs text-[var(--color-muted-text)]">Goal: {formatRupiah(target.target_amount)}</p>
                      </div>
                      <p className="text-xs font-semibold text-[var(--color-dawn-gold)]">{formatRupiah(target.monthly_contribution)} / mo</p>
                    </div>
                    
                    <div className="mt-2 flex items-center justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-[10px] text-[var(--color-muted-text)]">
                          <span>{formatRupiah(target.current_amount)}</span>
                          <span>{progressPct.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[var(--color-tactical-border)] overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-[var(--color-dawn-gold)]"
                            style={{ width: `${Math.min(100, progressPct)}%` }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => openLogSavings(target)}
                        className="flex h-7 items-center justify-center rounded border border-[var(--color-tactical-border)] px-2 text-xs font-medium text-[var(--color-pearl-text)] transition-colors hover:border-[var(--color-dawn-gold)] hover:text-[var(--color-dawn-gold)] shrink-0"
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Log
                      </button>
                    </div>
                  </div>
                );
              })}
              {savingsTargets.length === 0 && (
                <p className="text-xs text-[var(--color-muted-text)] italic">No savings targets found.</p>
              )}
            </div>
            
            {savingsError && (
              <p role="alert" className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-[var(--color-terracotta)]">
                <AlertTriangle className="mt-0.5 shrink-0" size={12} strokeWidth={2} aria-hidden="true" />
                <span>{savingsError}</span>
              </p>
            )}
          </div>
        </div>

        {/* Projected Daily Budget — read-only hero metric at bottom */}
        <div className="mt-6 rounded-lg border border-[var(--color-tactical-border)] bg-[var(--color-abyssal-slate)] px-4 py-4 shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-muted-text)]">
            Projected Safe Daily Budget
          </p>
          <p
            className="mt-1.5 text-2xl font-semibold tabular-nums text-[var(--color-muted-emerald)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {formatRupiah(projectedDailyBudget)}
            <span className="ml-1.5 font-sans text-sm font-normal text-[var(--color-muted-text)]">
              / day
            </span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted-text)]">
            (Income − Fixed Costs − Savings) ÷ 30. Recalculates based on your streams and targets.
          </p>
        </div>
      </div>

      <LogSavingsModal
        isOpen={isLogSavingsOpen}
        onClose={() => setIsLogSavingsOpen(false)}
        target={selectedTarget}
      />
    </div>
  );
}


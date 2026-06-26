'use client';

// =============================================================================
// components/finance/baselines/FinancialSummaryCard.tsx
//
// Unified financial summary combining Income Streams, Fixed Expenses, 
// Savings Targets, and the projected Daily Budget.
// =============================================================================

import { useState } from 'react';
import { 
  AlertTriangle, 
  TrendingUp, 
  PlusCircle, 
  Trash2, 
  Receipt,
  Calendar,
  PiggyBank,
  Edit2
} from 'lucide-react';
import { useWalletStore } from '@/components/finance/stores/walletStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetchClient } from '@/lib/apiClient.client';
import { toast } from 'sonner';

import type { FixedExpense } from '@/types/wallet.types';
import { AddFixedExpenseModal } from '@/components/finance/modals/AddFixedExpenseModal';
import { AddIncomeStreamModal } from '@/components/finance/modals/AddIncomeStreamModal';
import { AddSavingsTargetModal } from '@/components/finance/modals/AddSavingsTargetModal';

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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SummarySkeleton() {
  return (
    <div className="rounded-xl border border-[var(--color-tactical-border)] bg-[var(--color-canvas-surface)] animate-pulse">
      <div className="h-16 border-b border-[var(--color-tactical-border)]" />
      <div className="flex flex-col gap-6 px-6 py-5">
        <div className="h-24 bg-[var(--color-abyssal-slate)] rounded-lg" />
        <div className="h-24 bg-[var(--color-abyssal-slate)] rounded-lg" />
        <div className="h-24 bg-[var(--color-abyssal-slate)] rounded-lg" />
        <div className="h-24 bg-[var(--color-abyssal-slate)] rounded-lg" />
      </div>
    </div>
  );
}

// ─── Section Empty State ──────────────────────────────────────────────────────

function EmptyState({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center bg-[var(--color-abyssal-slate)] rounded-lg border border-[var(--color-tactical-border)] border-dashed">
      <p className="mb-3 text-sm font-medium text-[var(--color-muted-text)] font-sans">
        No {label.toLowerCase()} yet
      </p>
      <button
        type="button"
        onClick={onAdd}
        className={[
          'flex items-center gap-1.5 rounded-lg border border-[var(--color-muted-emerald)] px-3 py-1.5',
          'text-xs font-medium text-[var(--color-muted-emerald)]',
          'transition-colors duration-150 hover:bg-[var(--color-muted-emerald)]/10',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-muted-emerald)]',
        ].join(' ')}
      >
        <PlusCircle size={12} strokeWidth={2} aria-hidden="true" />
        Add {label}
      </button>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div className="flex justify-between items-center mb-3">
      <h3 className="font-display text-sm font-semibold text-[var(--color-pearl-text)]">{title}</h3>
      <button
        type="button"
        onClick={onAdd}
        className={[
          'flex items-center gap-1.5 rounded-lg border border-[var(--color-tactical-border)] px-2 py-1',
          'text-xs font-medium text-[var(--color-pearl-text)]',
          'transition-colors duration-150 hover:border-[var(--color-muted-emerald)]/50 hover:text-[var(--color-muted-emerald)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-muted-emerald)]',
        ].join(' ')}
      >
        <PlusCircle size={12} strokeWidth={2} aria-hidden="true" />
        Add
      </button>
    </div>
  );
}

// ─── Rows ─────────────────────────────────────────────────────────────────────

function EditButton({ ariaLabel, onClick }: { ariaLabel: string, onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={[
        'shrink-0 rounded-md p-1.5 text-[var(--color-muted-text)]',
        'transition-colors duration-150',
        'hover:bg-[var(--color-muted-emerald)]/10 hover:text-[var(--color-muted-emerald)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-muted-emerald)]',
      ].join(' ')}
    >
      <Edit2 size={13} strokeWidth={2} />
    </button>
  );
}

function RemoveButton({ onRemove, ariaLabel }: { onRemove: () => void, ariaLabel: string }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={ariaLabel}
      className={[
        'shrink-0 rounded-md p-1.5 text-[var(--color-muted-text)]',
        'transition-colors duration-150',
        'hover:bg-[var(--color-terracotta)]/10 hover:text-[var(--color-terracotta)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-muted-emerald)]',
      ].join(' ')}
    >
      <Trash2 size={13} strokeWidth={2} />
    </button>
  );
}

// ─── Main Card ────────────────────────────────────────────────────────────────

export function FinancialSummaryCard() {
  const isBootstrapped = useWalletStore((s) => s.isBootstrapped);
  const fixedExpenses = useWalletStore((s) => s.fixedExpenses);
  const loans = useWalletStore((s) => s.loans);
  const removeFixedExpense = useWalletStore((s) => s.removeFixedExpense);
  
  const queryClient = useQueryClient();

  const { data: incomeStreams = [], isPending: isIncomePending } = useQuery<IncomeStream[]>({
    queryKey: ['income_streams'],
    queryFn: () => apiFetchClient<IncomeStream[]>('income-streams/'),
  });

  const { data: savingsTargets = [], isPending: isSavingsPending } = useQuery<SavingsTarget[]>({
    queryKey: ['savings_targets'],
    queryFn: () => apiFetchClient<SavingsTarget[]>('savings-targets/'),
  });

  const [isAddIncomeOpen, setIsAddIncomeOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeStream | null>(null);

  const [isAddFixedOpen, setIsAddFixedOpen] = useState(false);

  const [isAddSavingsOpen, setIsAddSavingsOpen] = useState(false);
  const [editingSavings, setEditingSavings] = useState<SavingsTarget | null>(null);

  const deleteIncomeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/income-streams/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete income stream');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income_streams'] });
      toast.success('Income stream removed.');
    },
    onError: (err: any) => toast.error(err.message)
  });

  const deleteSavingsMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/savings-targets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete savings target');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings_targets'] });
      toast.success('Savings target removed.');
    },
    onError: (err: any) => toast.error(err.message)
  });

  const handleRemoveSavings = (id: string) => {
    if (window.confirm('Are you sure you want to remove this savings target?')) {
      deleteSavingsMutation.mutate(id);
    }
  };

  const isLoading = !isBootstrapped || isIncomePending || isSavingsPending;

  if (isLoading) {
    return <SummarySkeleton />;
  }

  const totalFixed = fixedExpenses.reduce((s, e) => s + e.amount, 0) + 
                     loans.reduce((s, l) => s + l.monthly_installment, 0);
  const totalIncome = incomeStreams.reduce((s, i) => s + i.amount, 0);
  const totalSavings = savingsTargets.reduce((s, t) => s + t.monthly_contribution, 0);

  const rawDailyBudget = (totalIncome - totalFixed - totalSavings) / 30;
  const projectedDailyBudget = Math.max(0, rawDailyBudget);
  const isOverBudget = rawDailyBudget < 0;

  return (
    <div
      className="rounded-xl border border-[var(--color-tactical-border)] bg-[var(--color-canvas-surface)] flex flex-col font-sans"
    >
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-[var(--color-tactical-border)] px-6 py-5 shrink-0">
        <div
          aria-hidden="true"
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-muted-emerald)]/10"
        >
          <TrendingUp className="text-[var(--color-muted-emerald)]" size={15} strokeWidth={2} />
        </div>
        <div>
          <h2 className="font-display text-[15px] font-semibold text-[var(--color-pearl-text)]">
            Financial Summary
          </h2>
          <p className="mt-0.5 text-sm text-[var(--color-muted-text)]">
            Your monthly baselines and derived daily budget.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-6 px-6 py-5">
        
        {/* 1. Income Streams */}
        <div>
          <SectionHeader title="Income Streams" onAdd={() => setIsAddIncomeOpen(true)} />
          {incomeStreams.length === 0 ? (
            <EmptyState label="Income" onAdd={() => setIsAddIncomeOpen(true)} />
          ) : (
            <div className="flex flex-col rounded-lg border border-[var(--color-tactical-border)] bg-[var(--color-canvas-surface)]">
              {incomeStreams.map((stream, idx) => (
                <div key={stream.id}>
                  <div className="flex items-center gap-4 py-3 px-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--color-pearl-text)]">{stream.name}</p>
                    </div>
                    <span className="shrink-0 tabular-nums text-sm font-medium text-[var(--color-pearl-text)]">
                      {formatRupiah(stream.amount)} <span className="text-xs text-[var(--color-muted-text)] font-normal">/ mo</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <EditButton ariaLabel={`Edit ${stream.name}`} onClick={() => {
                        setEditingIncome(stream);
                        setIsAddIncomeOpen(true);
                      }} />
                      <RemoveButton onRemove={() => deleteIncomeMutation.mutate(stream.id)} ariaLabel={`Remove ${stream.name}`} />
                    </div>
                  </div>
                  {idx < incomeStreams.length - 1 && <div className="border-t border-[var(--color-tactical-border)]/50" />}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--color-tactical-border)]/60" aria-hidden="true" />

        {/* 2. Fixed Expenses */}
        <div>
          <SectionHeader title="Fixed Expenses" onAdd={() => setIsAddFixedOpen(true)} />
          {fixedExpenses.length === 0 ? (
            <EmptyState label="Fixed Expense" onAdd={() => setIsAddFixedOpen(true)} />
          ) : (
            <div className="flex flex-col rounded-lg border border-[var(--color-tactical-border)] bg-[var(--color-canvas-surface)]">
              {fixedExpenses.map((expense, idx) => (
                <div key={expense.id}>
                  <div className="flex items-center gap-4 py-3 px-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--color-pearl-text)]">{expense.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-muted-text)]">
                        <Calendar size={10} strokeWidth={2} aria-hidden="true" />
                        {recurrenceLabel(expense)}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums text-sm font-medium text-[var(--color-pearl-text)]">
                      {formatRupiah(expense.amount)} <span className="text-xs text-[var(--color-muted-text)] font-normal">/ mo</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <EditButton ariaLabel={`Edit ${expense.name}`} />
                      <RemoveButton 
                        onRemove={() => {
                          removeFixedExpense(expense.id);
                          toast.success('Fixed expense removed.');
                        }} 
                        ariaLabel={`Remove ${expense.name}`} 
                      />
                    </div>
                  </div>
                  {idx < fixedExpenses.length - 1 && <div className="border-t border-[var(--color-tactical-border)]/50" />}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--color-tactical-border)]/60" aria-hidden="true" />

        {/* 3. Savings Targets */}
        <div>
          <SectionHeader title="Savings Targets" onAdd={() => setIsAddSavingsOpen(true)} />
          {savingsTargets.length === 0 ? (
            <EmptyState label="Savings Target" onAdd={() => setIsAddSavingsOpen(true)} />
          ) : (
            <div className="flex flex-col gap-3">
              {savingsTargets.map((target) => {
                const progressPct = target.target_amount > 0 ? (target.current_amount / target.target_amount) * 100 : 0;
                const d = new Date(target.deadline);
                const deadlineStr = isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                
                return (
                  <div key={target.id} className="p-4 rounded-lg border border-[var(--color-tactical-border)] bg-[var(--color-canvas-surface)] relative group">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-pearl-text)] pr-8">{target.name}</p>
                        <p className="text-xs text-[var(--color-muted-text)] flex items-center gap-1 mt-0.5">
                          <Calendar size={10} strokeWidth={2} />
                          Target Date: {deadlineStr}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <p className="text-xs font-semibold text-[var(--color-dawn-gold)]">{formatRupiah(target.monthly_contribution)} / mo</p>
                          <p className="text-[10px] text-[var(--color-muted-text)] mt-0.5">Planned Contribution</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <EditButton ariaLabel={`Edit ${target.name}`} onClick={() => {
                            setEditingSavings(target);
                            setIsAddSavingsOpen(true);
                          }} />
                          <RemoveButton onRemove={() => handleRemoveSavings(target.id)} ariaLabel={`Remove ${target.name}`} />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 space-y-1.5">
                      <div className="flex justify-between text-xs text-[var(--color-muted-text)] font-medium">
                        <span>{formatRupiah(target.current_amount)}</span>
                        <span>{formatRupiah(target.target_amount)}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[var(--color-abyssal-slate)] overflow-hidden border border-[var(--color-tactical-border)]">
                        <div 
                          className="h-full rounded-full bg-[var(--color-dawn-gold)] transition-all duration-300"
                          style={{ width: `${Math.min(100, progressPct)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Projected Daily Budget */}
        <div className={`mt-2 rounded-lg border px-4 py-4 shrink-0 transition-colors ${
          isOverBudget 
            ? 'border-[var(--color-terracotta)]/40 bg-[var(--color-terracotta)]/5' 
            : 'border-[var(--color-tactical-border)] bg-[var(--color-abyssal-slate)]'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-[11px] font-semibold uppercase tracking-widest ${isOverBudget ? 'text-[var(--color-terracotta)]' : 'text-[var(--color-muted-text)]'}`}>
                Projected Safe Daily Budget
              </p>
              <p
                className={`mt-1.5 text-2xl font-semibold tabular-nums font-display ${isOverBudget ? 'text-[var(--color-terracotta)]' : 'text-[var(--color-muted-emerald)]'}`}
              >
                {formatRupiah(projectedDailyBudget)}
                <span className={`ml-1.5 font-sans text-sm font-normal ${isOverBudget ? 'text-[var(--color-terracotta)]/80' : 'text-[var(--color-muted-text)]'}`}>
                  / day
                </span>
              </p>
            </div>
            {isOverBudget && (
              <div className="flex items-center gap-1.5 rounded-full bg-[var(--color-terracotta)]/10 px-2 py-1 text-[10px] font-medium text-[var(--color-terracotta)]">
                <AlertTriangle size={12} strokeWidth={2} />
                <span>Over Budget</span>
              </div>
            )}
          </div>
          
          {isOverBudget ? (
            <p className="mt-2 text-xs leading-relaxed text-[var(--color-terracotta)]/80">
              Your fixed costs and savings ({formatRupiah(totalFixed + totalSavings)}) exceed your income ({formatRupiah(totalIncome)}).
            </p>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted-text)]">
              (Income − Fixed Costs − Savings) ÷ 30.
            </p>
          )}
        </div>
      </div>

      <AddIncomeStreamModal
        isOpen={isAddIncomeOpen}
        onClose={() => {
          setIsAddIncomeOpen(false);
          setEditingIncome(null);
        }}
        initialData={editingIncome}
      />
      <AddFixedExpenseModal
        isOpen={isAddFixedOpen}
        onClose={() => setIsAddFixedOpen(false)}
      />
      <AddSavingsTargetModal
        isOpen={isAddSavingsOpen}
        onClose={() => {
          setIsAddSavingsOpen(false);
          setEditingSavings(null);
        }}
        initialData={editingSavings}
      />
    </div>
  );
}

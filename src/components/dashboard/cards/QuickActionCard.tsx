'use client';

import { Plus, CheckCircle2, Info } from 'lucide-react';
import { useDashboardModals } from '../hooks/useDashboardModals';
import { useDashboardData } from '../hooks/useDashboardData';

export function QuickActionCard() {
  const { openAddTransaction, openZeroSpend } = useDashboardModals();
  const { data } = useDashboardData();
  const { daily_status } = data;
  const canClaimZeroSpend = !daily_status.zero_spend_marked && daily_status.spent_today === 0;

  return (
    <article className="bg-canvas-surface border border-tactical-border rounded-xl p-6 h-full flex flex-col">
      {/* Header */}
      <h2 className="font-display text-sm font-semibold text-pearl-text uppercase tracking-widest mb-4">
        Quick Actions
      </h2>

      {/* Description */}
      <p className="font-sans text-sm text-muted-text leading-relaxed flex-1">
        Record spending, income, or transfers to keep your financial progress
        accurate and up to date.
      </p>

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-3">
        <button
          onClick={openAddTransaction}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-muted-emerald text-abyssal-slate font-sans text-sm font-medium transition-colors duration-150 hover:bg-muted-emerald/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-emerald focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface"
          type="button"
        >
          <Plus size={15} strokeWidth={2.5} />
          Add Transaction
        </button>

        <button
          onClick={openZeroSpend}
          disabled={!canClaimZeroSpend}
          className={[
            "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-sans text-sm font-medium transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-border focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface",
            canClaimZeroSpend
              ? "bg-abyssal-slate text-pearl-text border border-tactical-border hover:bg-tactical-border/50"
              : "bg-abyssal-slate/50 text-muted-text border border-tactical-border/50 opacity-60 cursor-not-allowed"
          ].join(' ')}
          type="button"
        >
          <CheckCircle2 size={15} strokeWidth={2.5} />
          {daily_status.zero_spend_marked ? "Zero-Spend Claimed" : "Claim Zero-Spend"}
        </button>
        <div className="flex items-center justify-center gap-1 mt-1 group/tooltip relative">
          <span className="text-[11px] text-muted-text">About zero spend</span>
          <Info size={12} className="text-muted-text hover:text-pearl-text cursor-help transition-colors" />
          
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-abyssal-slate border border-tactical-border rounded-md shadow-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
            <p className="text-[10px] text-muted-text leading-tight whitespace-normal text-center">
              Click zero spend if there is no transaction made in the day, protect Grants XP and protects against the midnight Ghost Penalty.
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

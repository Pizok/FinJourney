'use client';

import { Plus } from 'lucide-react';
import { useDashboardModals } from '../hooks/useDashboardModals';

export function QuickActionCard() {
  const { openAddTransaction } = useDashboardModals();

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

      {/* Primary CTA */}
      <div className="mt-6">
        <button
          onClick={openAddTransaction}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-muted-emerald text-abyssal-slate font-sans text-sm font-medium transition-colors duration-150 hover:bg-muted-emerald/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-emerald focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface"
          type="button"
        >
          <Plus size={15} strokeWidth={2.5} />
          Add Transaction
        </button>
      </div>
    </article>
  );
}

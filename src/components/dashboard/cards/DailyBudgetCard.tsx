'use client';

import { useDashboardData } from '../hooks/useDashboardData';
import { formatCurrency, clampPercent } from '../utils/dashboard.helpers';

export function DailyBudgetCard() {
  const { data } = useDashboardData();
  const { daily_status } = data;

  const {
    daily_budget,
    spent_today,
    remaining_budget,
    budget_percent_used,
    zero_spend_marked,
    standby_active,
  } = daily_status;

  const spentPercent = clampPercent(budget_percent_used);
  const isOverspent = spent_today > daily_budget;

  // Bar color: overspent → terracotta, otherwise muted-emerald
  const barClass = isOverspent ? 'bg-terracotta' : 'bg-muted-emerald';

  return (
    <article className="bg-canvas-surface border border-tactical-border rounded-xl p-6 h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-pearl-text uppercase tracking-widest">
          Daily Budget
        </h2>

        {/* Status pill */}
        {(zero_spend_marked || standby_active) && (
          <span className="font-sans text-[10px] uppercase tracking-widest border border-tactical-border rounded-full px-2.5 py-0.5 text-muted-text">
            {standby_active ? 'Standby' : 'Zero-Spend'}
          </span>
        )}
      </div>

      {/* Hero number */}
      <div className="flex-1">
        <p className="font-sans text-xs text-muted-text mb-1">
          Remaining Today
        </p>
        <p
          className={[
            'font-display text-4xl font-semibold leading-none tracking-tight',
            isOverspent ? 'text-terracotta' : 'text-pearl-text',
          ].join(' ')}
        >
          {formatCurrency(remaining_budget)}
        </p>
      </div>

      {/* Progress bar */}
      <div>
        <div
          className="h-1.5 rounded-full bg-abyssal-slate overflow-hidden"
          role="progressbar"
          aria-label="Daily budget used"
          aria-valuenow={spentPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${barClass}`}
            style={{ width: `${spentPercent}%` }}
          />
        </div>
        <p className="font-sans text-xs text-muted-text mt-1.5 text-right">
          {spentPercent}% used
        </p>
      </div>

      {/* Spent / Limit row */}
      <div className="grid grid-cols-2 gap-4 pt-1 border-t border-tactical-border">
        <div>
          <p className="font-sans text-[10px] uppercase tracking-widest text-muted-text mb-0.5">
            Spent Today
          </p>
          <p className="font-sans text-sm font-medium text-pearl-text">
            {formatCurrency(spent_today)}
          </p>
        </div>
        <div>
          <p className="font-sans text-[10px] uppercase tracking-widest text-muted-text mb-0.5">
            Daily Limit
          </p>
          <p className="font-sans text-sm font-medium text-pearl-text">
            {formatCurrency(daily_budget)}
          </p>
        </div>
      </div>
    </article>
  );
}

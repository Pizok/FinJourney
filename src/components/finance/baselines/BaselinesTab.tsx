'use client';

// =============================================================================
// components/wallet/baselines/BaselinesTab.tsx
//
// Orchestrator for the "Baselines & Debt" tab content.
//
// Layout: stacked vertical, gap-6 between cards.
//   1. FinancialSummaryCard  — income, fixed expenses, savings, projected daily budget
//   2. ActiveLoans           — active debt list with progress bars (full width)
// =============================================================================

import { FinancialSummaryCard } from './FinancialSummaryCard';
import { ActiveLoans } from './ActiveLoans';

export function BaselinesTab() {
  return (
    <div className="flex flex-col gap-6">
      <FinancialSummaryCard />
      <ActiveLoans />
    </div>
  );
}

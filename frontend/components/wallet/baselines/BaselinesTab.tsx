'use client';

// =============================================================================
// components/wallet/baselines/BaselinesTab.tsx
//
// Orchestrator for the "Baselines & Debt" tab content.
//
// Layout: stacked vertical, gap-6 between cards.
//   1. FinancialAssumptionsCard  — income, savings, projected daily budget
//   2. FixedExpenses             — recurring fixed costs list (full width)
//   3. ActiveLoans               — active debt list with progress bars (full width)
// =============================================================================

import { FinancialAssumptionsCard } from './FinancialAssumptionsCard';
import { FixedExpenses } from './FixedExpenses';
import { ActiveLoans } from './ActiveLoans';

export function BaselinesTab() {
  return (
    <div className="flex flex-col gap-6">
      <FinancialAssumptionsCard />
      <FixedExpenses />
      <ActiveLoans />
    </div>
  );
}

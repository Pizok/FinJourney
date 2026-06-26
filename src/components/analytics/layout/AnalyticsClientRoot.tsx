'use client'

/**
 * AnalyticsClientRoot.tsx
 *
 * Client boundary for the Analytics page.
 *
 * Responsibilities:
 *  1. Bootstraps the analyticsStore with mock data on mount (identical pattern
 *     to WalletShell). Real API fetch is drafted and commented out for Part 2.
 *  2. Renders AnalyticsShell (which handles locked/loading/unlocked routing).
 *  3. Passes the full analytics grid as children to AnalyticsShell so the
 *     shell can conditionally render them only when the user is unlocked.
 *  4. Renders the modal layer at the top level so modals are always in the DOM.
 *
 * Canonical path: components/analytics/layout/AnalyticsClientRoot.tsx
 */

import { useQuery } from '@tanstack/react-query'
import { AnalyticsShell } from './AnalyticsShell'
import { AnalyticsHeader } from './AnalyticsHeader'
import { DashboardSidebar } from '@/components/dashboard/layout/DashboardSidebar'
import { AdvisoryCard } from '../advisory/AdvisoryCard'
import { CashflowChart } from '../cashflow/CashflowChart'
import { TopTransactionsCard } from '../transactions/TopTransactionsCard'
import { IncomeAllocationCard } from '../allocation/IncomeAllocationCard'
import { CategoryPieChart } from '../categories/CategoryPieChart'
import { DebtHealthCard } from '../debt/DebtHealthCard'
import { AssetHealthCard } from '../assets/AssetHealthCard'
import { RebalanceBudgetModal } from '../modals/RebalanceBudgetModal'
import { LoanSimulatorModal } from '../modals/LoanSimulatorModal'
import { SavingsGoalModal } from '../modals/SavingsGoalModal'
import { AnalyticsProvider, type AnalyticsData } from './AnalyticsContext'
import { apiFetchClient } from '@/lib/apiClient.client'
import { useDashboardStore } from '@/components/dashboard/stores/dashboardStore'
import { useAnalyticsStore } from '../stores/analyticsStore'
import { AnalyticsEmptyState } from './AnalyticsEmptyState'

// ─── Analytics Grid ────────────────────────────────────────────────────────────
// The full bento-box grid rendered when the user is Level 3+.
// Matches the PRD § 5 layout exactly:
//   Row 1 — Advisory (full-width)
//   Row 2 — Cashflow (60%) | Top Transactions (40%)
//   Row 3 — Income Allocation (50%) | Category Breakdown (50%)
//   Row 4 — Debt Health (50%) | Asset Health (50%)

function AnalyticsGrid() {
  return (
    <div className="flex flex-col gap-4">
      {/* Row 1 — Advisory + Financial Stability Score */}
      <AdvisoryCard />

      {/* Row 2 — Cashflow (lg:3/5) | Top Transactions (lg:2/5) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CashflowChart />
        </div>
        <div className="lg:col-span-2">
          <TopTransactionsCard />
        </div>
      </div>

      {/* Row 3 — Income Allocation (1/2) | Category Pie (1/2) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <IncomeAllocationCard />
        <CategoryPieChart />
      </div>

      {/* Row 4 — Debt Health (1/2) | Asset Health (1/2) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DebtHealthCard />
        <AssetHealthCard />
      </div>
    </div>
  )
}

// ─── AnalyticsClientRoot ───────────────────────────────────────────────────────

export function AnalyticsClientRoot() {
  const { timeRange } = useAnalyticsStore()
  
  // Try to get user level from dashboard store
  // If it's undefined, the user might have navigated directly to /analytics
  const userLevel = useDashboardStore((s) => s.data?.profile.level)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics', 'overview', timeRange],
    queryFn: () => apiFetchClient<AnalyticsData>(`analytics/overview?timeframe=${timeRange}`),
    enabled: (userLevel ?? 0) >= 3,
  })

  // We are locked if:
  // 1. Data explicitly says locked
  // 2. Or we know userLevel < 3
  // 3. Or query is loading/idle but user is known to be < 3
  const isLocked = data 
    ? !data.unlock_status.unlocked 
    : (userLevel !== undefined && userLevel < 3)

  return (
    <div className="flex min-h-screen bg-abyssal-slate">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8">

            {/* Page Header — always visible, toggle disabled when locked */}
            <AnalyticsHeader isLocked={isLocked} />

            {/* Shell — routes to locked overlay or full grid */}
            <AnalyticsShell isLoading={isLoading && !data} isError={isError} locked={isLocked} data={data}>
              {data && (
                <AnalyticsProvider data={data}>
                  {data.top_transactions.length === 0 && data.cashflow.series.length === 0 ? (
                    <AnalyticsEmptyState />
                  ) : (
                    <AnalyticsGrid />
                  )}
                  <RebalanceBudgetModal />
                  <LoanSimulatorModal />
                  <SavingsGoalModal />
                </AnalyticsProvider>
              )}
            </AnalyticsShell>

          </div>
        </div>
      </main>
    </div>
  )
}

# Analytics Component Map — FinJourney

## Route Structure

```txt
app/(minimal)/analytics/page.tsx
```

Analytics uses:

* Minimal Application Layout
* Persistent Sidebar
* No Landing Header
* No Landing Footer

Access:

* Locked until Level 3
* Accessible before unlock via Preview Mode

---

# Recommended Folder Structure

```txt
app/
└── (minimal)/
    └── analytics/
        └── page.tsx

components/
└── analytics/
    ├── layout/
    │   ├── AnalyticsShell.tsx
    │   ├── AnalyticsHeader.tsx
    │   └── AnalyticsGrid.tsx
    │
    ├── access/
    │   ├── AnalyticsLockedOverlay.tsx
    │   ├── AnalyticsPreview.tsx
    │   └── UnlockProgress.tsx
    │
    ├── advisory/
    │   ├── AdvisoryCard.tsx
    │   ├── FinancialStabilityScore.tsx
    │   ├── ScoreTrend.tsx
    │   ├── RecommendationItem.tsx
    │   └── RebalanceBudgetButton.tsx
    │
    ├── cashflow/
    │   ├── CashflowChart.tsx
    │   ├── CashflowTrendIndicator.tsx
    │   └── CashflowSection.tsx
    │
    ├── transactions/
    │   ├── TopTransactionsCard.tsx
    │   ├── TopTransactionList.tsx
    │   └── TopTransactionItem.tsx
    │
    ├── allocation/
    │   ├── IncomeAllocationCard.tsx
    │   ├── AllocationMetric.tsx
    │   └── RemainingIndicator.tsx
    │
    ├── categories/
    │   ├── CategoryPieChart.tsx
    │   ├── CategoryLegend.tsx
    │   └── OverspendingBadge.tsx
    │
    ├── debt/
    │   ├── DebtHealthCard.tsx
    │   ├── DTIIndicator.tsx
    │   ├── SafeLoanLimit.tsx
    │   ├── DebtFreeDate.tsx
    │   └── LoanSimulatorButton.tsx
    │
    ├── assets/
    │   ├── AssetHealthCard.tsx
    │   ├── SurvivalRunway.tsx
    │   ├── AssetAllocationBar.tsx
    │   ├── SavingsProgress.tsx
    │   └── SavingsTargetButton.tsx
    │
    ├── modals/
    │   ├── RebalanceBudgetModal.tsx
    │   ├── LoanSimulatorModal.tsx
    │   └── SavingsTargetModal.tsx
    │
    ├── states/
    │   ├── AnalyticsSkeleton.tsx
    │   ├── AnalyticsErrorState.tsx
    │   ├── NoChartDataState.tsx
    │   └── MissingFinancialDataState.tsx
    │
    ├── hooks/
    │   ├── useAnalyticsData.ts
    │   ├── useAnalyticsRange.ts
    │   ├── useLoanSimulator.ts
    │   └── useRebalanceBudget.ts
    │
    ├── stores/
    │   └── analyticsStore.ts
    │
    └── types/
        └── analytics.types.ts
```

---

# Page Structure

```txt
AnalyticsPage
│
├── AnalyticsHeader
│    └── TimeRangeToggle
│
├── AnalyticsLockedOverlay (conditional)
│
├── AdvisoryCard
│    ├── FinancialStabilityScore
│    ├── ScoreTrend
│    ├── RecommendationItem
│    └── RebalanceBudgetButton
│
├── CashflowSection
│    ├── CashflowChart
│    └── CashflowTrendIndicator
│
├── TopTransactionsCard
│
├── IncomeAllocationCard
│
├── CategoryPieChart
│
├── DebtHealthCard
│
├── AssetHealthCard
│
├── RebalanceBudgetModal
├── LoanSimulatorModal
└── SavingsTargetModal
```

---

# Libraries

Required:

* Zustand
* TanStack Query
* Recharts
* React Hook Form
* Zod
* shadcn/ui

Avoid:

* BI dashboards
* TradingView
* Enterprise reporting systems

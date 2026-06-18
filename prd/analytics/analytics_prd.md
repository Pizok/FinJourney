# Analytics Page Product Requirements — FinJourney

**register:** product
**target:** `app/(minimal)/analytics/page.tsx`

## 1. Page Purpose
The Analytics page is an actionable advisory dashboard focusing purely on real-world financial health. It provides cash flow trends, debt reality checks, spending behavior breakdowns, and a realistic Financial Stability Score. It acts as a financial coach, not a complex trading terminal.

---

## 2. Access Requirements
Analytics unlocks at Level 3.
*   **Users below Level 3:** Can access the route but see a feature preview. Charts and tools remain disabled behind an overlay. A progress indicator shows the remaining XP required to unlock the page.

---

## 3. Page Controls & Performance Rules
*   **Global Time Toggle:** Button group (`1W`, `1M`, `1Y`, `All`) instantly updates all charts and metrics without a full reload. Default state is `1M`.
*   **Data Freshness:** Analytics reflect real-time data and update immediately after transaction creation, edits, deletions, or budget rebalancing. 
*   **Refresh Performance:** The frontend must only refresh affected sections after mutations. Avoid full dashboard re-fetches or complete chart re-renders.
*   **Current Scope:** Export functionality (PDF, CSV) is not included in this phase.

---

## 4. Calculation & Metric Definitions
To prevent architectural ambiguity, calculations must adhere strictly to these definitions. All financial math must use backend precision; the frontend handles formatting only.

*   **Cashflow:** `Income` lines consist solely of income transactions. `Expense` lines consist solely of expense transactions. Transfers are strictly excluded.
*   **Trend Comparison Rules:** 
    *   `1W` → compared to previous week
    *   `1M` → compared to previous month
    *   `1Y` → compared to previous year
    *   `All` → compared to overall historical average
*   **Top Transactions:** Sorted by the highest expense amount (absolute value) within the selected timeframe.
*   **Overspending Threshold:** Triggered when `Spent Amount > Category Limit`.
*   **Baseline Cost Source:** Baseline Costs displayed in Analytics are derived strictly from the user-configured Baseline settings. Editing values on the Baseline page automatically updates Analytics calculations.
*   **Debt-to-Income (DTI) Ratio:** `(Monthly Debt Payments / Monthly Income) * 100`. 
    *   Good: < 20% | Warning: 21–35% | Bad: > 35%.
*   **Safe Loan Limit:** Calculated exclusively by the backend. The frontend displays the recommended maximum monthly debt capacity and an explanatory tooltip.
*   **Survival Runway:** `Liquid Cash (Bank/Cash Wallet Balances) / Average Monthly Expenses`.
*   **Asset Allocation:** `Idle Cash` (Wallet balances) vs. `Invested` (Investment accounts/assets).
*   **Financial Stability Score:** A 0–100 non-game metric based on cashflow, debt, savings, and spending discipline. 
    *   **Backend Authority:** The backend is the sole authority for the score calculation. The formula may evolve without requiring frontend changes. The frontend only displays the score value, the trend direction (e.g., "+4 this month"), and supporting explanations.

---

## 5. Layout Structure (Bento Box Architecture)

### Row 1: Immediate Action Required (Advisory)
*   **Layout:** Wide card spanning the top. Contains the **Financial Stability Score** and its **Score Trend** (e.g., "78 (+4 this month)") displayed quietly as a baseline metric.
*   **Advisory Priority Order:** Only one primary recommendation appears at a time, governed by this hierarchy:
    1.  Critical debt risk
    2.  Upcoming payment risk
    3.  Severe overspending
    4.  Savings target failure
    5.  Optimization suggestions
*   **Right Side (Action Blocks):** 1–3 specific budget reduction targets based on the primary advisory. 
*   **Control:** "Rebalance Budget" button attached to the recommendation.

### Row 2: The Macro View
*   **Left Side (60% width):** Cashflow Line Chart showing money in vs. money out over the selected time range. Includes the Cash Flow Trend indicator.
*   **Right Side (40% width):** Top 5 Transactions list. Clicking any transaction redirects the user to `/wallet?highlight=[id]`. The target page must scroll the transaction into view and visually highlight it for several seconds.

### Row 3: Income Allocation & Category Breakdown
*   **Left Side (50% width):** Income Allocation Summary displaying Total Income, Baseline Costs (rent, food, parking, subscriptions), Variable Spending (entertainment, dining out), and Remaining/Deficit.
*   **Right Side (50% width):** Category Pie Chart highlighting specific breakdown percentages and clearly marking overspending categories.

### Row 4: Long-Term Reality Check
*   **Left Side (Debt Health):** DTI status indicator, total active loans, estimated Debt-Free Date, and "Safe Loan Limit" in exact monetary value. Includes a "Test a Loan" button.
*   **Right Side (Asset Health & Targets):** Survival Runway metric, Asset Allocation bar, and Savings Target Progress bar. Includes a "Set/Edit Target" button.

---

## 6. Interaction Flows & Modals

### The "Rebalance Budget" Logic (Zero-Sum Rule)
Triggered from Row 1. A modal to fix an overspent category.
*   **Option 1 - Reduce Other Budgets:** Select other categories with remaining limits and reduce them. Total reductions must equal the overspent amount to apply the fix.
*   **Option 2 - Increase Overspent Budget:** Raise the limit by drawing from Unallocated Income, reducing the Savings Target, or cutting another category.
*   **Constraints:** Categories cannot be reduced below zero remaining budget or required baseline minimums. The system blocks invalid reallocations.
*   **Success Result:** Category limits update instantly, the advisory card refreshes, the daily safe spending limit recalculates, and a success notification appears.

### Mini-Tools
*   **Loan Simulator:** Triggered by "Test a Loan". User inputs a hypothetical monthly installment; the system returns the projected DTI status.
*   **Savings Target Setter:** Triggered by "Set Target". Requests Target Name, Amount, and Deadline Date. **Current Scope:** Only one active savings target is supported.

---

## 7. UI, States, & Visual Rules
*   **Chart Rules:** Use strictly Line charts (Cashflow) and Pie charts (Category Breakdown). Avoid 3D charts, animated charts, or visual clutter.
*   **Status Color Semantics:** Do not introduce random colors. Stick to:
    *   Good: Muted Emerald
    *   Warning: Dawn Gold
    *   Bad: Terracotta
*   **Loading States:** Use skeletons for advisory blocks, charts, and metrics during initial load. When toggling timeframes, charts must preserve previous data on screen until the new data arrives to prevent layout shift.
*   **Empty & Missing Data States:**
    *   *No Chart Data:* Display "Not enough data for this timeframe" on the charts if the date range exceeds available data.
    *   *Missing Inputs:* If required financial data (no debt, no income, no savings target) is unavailable, display contextual guidance instead of estimated or zeroed metrics.
    *   *Asset Allocation Fallback:* If no investment assets exist, set Invested = 0, keep the allocation bar visible, and display: "No investment assets recorded."
    *   *Zero Debt:* Display a "Good" condition status stating "You are currently debt-free," while retaining the Safe Loan Limit calculation.
    *   *Debt-Free Date:* If insufficient payment information exists, explicitly display "Unable to estimate" rather than faking a date.
*   **Responsive Rules:** On mobile, the Bento Box grid collapses into a single-column vertical stack. Charts automatically resize for available width. For larger datasets, labels may be abbreviated or selectively hidden.

---

## 8. Current Scope Boundaries
This page focuses exclusively on:
*   Cashflow analysis
*   Spending behavior
*   Debt health
*   Savings progress
*   Financial stability

**This page does NOT include:**
*   Investment performance tracking
*   Stock portfolio analytics
*   Forecasting or predictive AI
*   Tax calculations
*   Budgeting history audit logs
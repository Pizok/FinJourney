# Analytics Backend Architecture — FinJourney

**register:** technical_spec
**target:** `app/api/v1/endpoints/`, `app/services/`, `app/db/queries/`, `app/schemas/`

## Read-Only Boundary and System Constraints
The Analytics module is a read-heavy aggregation layer within the FastAPI app. It functions strictly as the definitive source of truth for all derived financial metrics and never mutates ledger data.

* **Strict Read-Only:** The `POST /wallets/rebalance-budget` action belongs to the Wallet service. Analytics only returns the recommendation payload.
* **No Server-Side Caching:** Analytics requests generate synchronously from the current database state.
* **Maximum Query Window:** To protect database resources, the `all` timeframe is capped at a maximum 5-year lookback, and cashflow series are capped at 365 data points.

---

## Source of Truth and Data Dependencies
Analytics infers states directly from normalized tables and leverages daily snapshots for historical trend comparisons rather than recalculating past states from raw transactions.

**Required Tables:**
* `wallets`, `categories`, `transactions`
* `player_state`: Evaluates `level` and `xp` for access gating.
* `baselines`: Fetches fixed baseline costs for income allocation.
* `daily_snapshots`: Fetches historical `financial_stability_score` for trend calculations.

**New Schema: `savings_targets`**
* `id`: UUID, Primary Key
* `user_id`: UUID, Foreign Key
* `name`: String
* `target_amount`: Integer (cents)
* `current_amount`: Integer (cents)
* `deadline`: Date
* `status`: Enum (`active`, `completed`, `archived`)
* `created_at`: Timestamp
* `deleted_at`: Timestamp (Nullable)

---

## Financial Logic and Scoring Algorithms

### Asset and Debt Calculations
* **Liquid Cash:** `SUM(wallet.balance) WHERE type IN ('cash', 'bank', 'savings')`
* **Net Liquid Cash:** `Liquid Cash + SUM(credit wallet balances)`
* **Invested Assets:** `SUM(wallet.balance) WHERE type = 'investment'`
* **Active Loans:** `COUNT(wallets) WHERE type = 'credit' AND balance < 0`
* **Monthly Debt Payments:** `SUM(expense.amount) WHERE category.type = 'debt_payment' AND transaction_date within current month`
* **DTI (Debt-to-Income):** `(Monthly Debt Payments / Monthly Income) * 100`

### Projections and Targets
* **Debt-Free Projection:** 1. `average_monthly_debt_payment` = Average of debt payment category spending over the last 3 months.
  2. `remaining_debt` = `ABS(SUM(credit wallet balances))`
  3. `projected_months` = `remaining_debt / average_monthly_debt_payment`
  4. Output as `debt_free_date` (Current Date + `projected_months`).
* **Savings Target Selection:** Analytics evaluates all active targets and surfaces only the single target with the earliest `deadline` ASC.
* **Behind Schedule Formula:** * `expected_percentage = (days_elapsed / total_days) * 100`
  * `is_behind_schedule = actual_progress_percentage < expected_percentage`

### Score and Trend Math
* **Financial Stability Score (0-100):** * Cashflow Health (30 points), Debt Health (30 points), Savings Runway (20 points), Spend Discipline (20 points).
* **Score Trend:** `current_score - historical_score`. The `historical_score` is pulled directly from the `daily_snapshots` table corresponding to the requested timeframe offset (e.g., 7 days ago, 30 days ago).
* **Trend Percentage Formula:** `((current_period - previous_period) / previous_period) * 100`. 
  * *Edge Case:* If `previous_period == 0`, the trend percentage returns `null`.
* **Category Percentage:** `(spent / monthly_limit) * 100`

### Advisory Priority Logic
Returns exactly **one** primary advisory based on this top-down hierarchy:
1.  **critical_debt:** DTI > 35%.
2.  **upcoming_payment:** `liquid_cash` < `baseline_costs`.
3.  **overspending:** Any category is > 110% of its monthly limit.
4.  **savings_target:** Active target is mathematically behind schedule.
5.  **optimization:** Default fallback.

---

## Timeframe Definitions and Granularity
* **`1w`:** Current day + previous 6 days (Trend vs. previous 7 days). Granularity: Daily.
* **`1m`:** Current day + previous 29 days (Trend vs. previous 30 days). Granularity: Daily.
* **`1y`:** Current day + previous 364 days (Trend vs. previous 365 days). Granularity: Monthly.
* **`all`:** Earliest transaction until today (Max 5 years). Granularity: Monthly.
* **Timezone Rule:** All calculations strictly use the user's timezone from `profile.timezone`. Fallback: `UTC+7`.

**Invalid Timeframe Error:**

    {
      "error": "invalid_timeframe"
    }

---

## Analytics Payload and API Contract

### `GET /api/v1/analytics/overview?timeframe=1m`

    {
      "analytics_version": 1,
      "generated_at": "2026-05-31T08:45:00Z",
      "timeframe": "1m",
      "unlock_status": {
        "unlocked": true,
        "required_level": 3,
        "current_level": 5,
        "xp_remaining": 0
      },
      "financial_stability": {
        "score": 78,
        "score_version": 1,
        "score_trend": 4,
        "explanation": "Healthy cashflow but high variable spending."
      },
      "advisory": {
        "priority": "overspending",
        "headline": "Reduce Food Spending",
        "recommendation": "Cut Food by Rp 300.000 to balance your budget.",
        "suggested_actions": [
          {
            "category_id": "uuid",
            "category_name": "Food",
            "reduction_amount": 300000
          }
        ]
      },
      "cashflow": {
        "has_data": true,
        "granularity": "daily",
        "trend_percentage": 5.2,
        "series": [
          {
            "label": "2026-05-01",
            "income": 100000,
            "expense": 50000
          }
        ]
      },
      "income_allocation": {
        "has_income": true,
        "total_income": 10000000,
        "baseline_costs": 4000000,
        "variable_spending": 3000000,
        "remaining_amount": 3000000
      },
      "category_breakdown": {
        "has_category_data": true,
        "categories": [
          {
            "category_id": "uuid",
            "name": "Food",
            "spent": 450000,
            "percentage": 45,
            "is_overspent": false
          }
        ]
      },
      "top_transactions": [
        {
          "id": "uuid",
          "amount": 750000,
          "category_name": "Food",
          "wallet_name": "Bank",
          "transaction_date": "2026-05-20",
          "note": "Dinner"
        }
      ],
      "debt_health": {
        "dti_percentage": 15,
        "status": "good",
        "active_loans": 1,
        "safe_loan_limit": 1500000,
        "debt_free_date": "2028-04-15",
        "debt_free_date_reason": null
      },
      "asset_health": {
        "liquid_cash": 25000000,
        "net_liquid_cash": 20000000,
        "invested_assets": 0,
        "has_investments": false,
        "survival_runway_months": 3.5,
        "savings_target": {
          "has_savings_target": true,
          "target_name": "Emergency Fund",
          "target_amount": 10000000,
          "current_amount": 4500000,
          "progress_percentage": 45,
          "deadline": "2026-12-31",
          "is_behind_schedule": false
        }
      }
    }

---

## Query Optimization and Implementation Modules

### Execution Limits
* `analytics_service.py` must use `asyncio.gather()` for concurrent query fetching.
* Grouping logic for breakdowns must happen in PostgreSQL (`GROUP BY`).
* Top Transactions limit: 5 rows.
* Category Breakdown limit: Top 10 by spending; all remaining grouped into "Other".
* Empty Income Allocation: Returns `has_income: false` with all nested values as `0`.

### `app/db/queries/analytics_queries.py`
Requires the following indexes on `transactions`:
* `(user_id, transaction_date)`
* `(user_id, category_id)`
* `(user_id, status)`
* `(user_id, type)`
* `(user_id, amount)`

### Service Layer Isolation
* `app/services/analytics_service.py`: Exclusively handles orchestration and mapping.
* `app/services/scoring_service.py`: Exclusively stores the isolated logic for `is_behind_schedule`, `trend_percentage`, `advisory`, and `financial_stability_score`.
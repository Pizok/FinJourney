# Backend Implementation File Map — FinJourney Analytics

**register:** implementation_guide
**target:** FastAPI Monolith

To implement the Analytics and Scoring system, the following files must be created or updated within the existing FastAPI directory structure. 

## 1. Pydantic Schemas (`app/schemas/`)
These files handle request validation and the massive outgoing dashboard payload.

* **`analytics.py`**
    * `AnalyticsOverviewResponse`: The massive, strict payload mapping exactly to the frontend hydration contract (includes `financial_stability`, `advisory`, `cashflow`, etc.).
    * `SimulateLoanRequest` & `SimulateLoanResponse`: Validation for the stateless loan calculator.
* **`savings_targets.py`** *(New)*
    * `SavingsTargetCreate`, `SavingsTargetUpdate`, `SavingsTargetOut`: Standard CRUD schemas for the new savings targets feature.
* **`wallet.py`** *(Update)*
    * Add `RebalanceBudgetRequest` to handle the payload for the `POST /wallets/rebalance-budget` endpoint.

## 2. Database Queries (`app/db/queries/`)
These files isolate the heavy PostgreSQL `GROUP BY` operations. All functions here should be asynchronous.

* **`analytics_queries.py`**
    * `get_cashflow_series(user_id, start_date, end_date, granularity)`: Uses SQL `GROUP BY` (Day or Month) to sum income and expenses.
    * `get_category_breakdown(user_id, start_date, end_date)`: Sums expenses grouped by category, ordered by amount descending.
    * `get_top_transactions(user_id, start_date, end_date)`: Fetches the top 5 largest expense transactions.
    * `get_monthly_debt_payments(user_id, current_month)`: Sums spending for categories tagged as `debt_payment`.
* **`savings_targets_queries.py`** *(New)*
    * `get_active_savings_targets(user_id)`: Fetches targets ordered by deadline ASC.

## 3. Business Logic Services (`app/services/`)
This is where the math happens and where the concurrent database calls are orchestrated.

* **`scoring_service.py`** *(New - Pure Math)*
    * `calculate_financial_stability(cashflow, dti, runway, overspent_count)`: Returns the 0-100 score.
    * `determine_advisory_priority(dti, liquid_cash, baseline, categories, savings_target)`: Returns the single top-priority advisory action.
    * `calculate_debt_free_date(remaining_debt, avg_monthly_payment)`
    * `is_savings_behind_schedule(actual_progress, days_elapsed, total_days)`
* **`analytics_service.py`** *(New - Orchestration)*
    * `get_overview_payload(user_id, timeframe)`: The main engine. Uses `asyncio.gather()` to fetch data from `analytics_queries`, `wallet_queries`, and `daily_queries` concurrently. It passes that raw data to `scoring_service`, assembles the final dictionary, and returns it.
* **`wallet_service.py`** *(Update)*
    * `rebalance_budget(user_id, payload)`: Implements the actual category limit adjustments recommended by the analytics advisory.

## 4. FastAPI Endpoints (`app/api/v1/endpoints/`)

* **`analytics.py`**
    * `GET /analytics/overview?timeframe={val}`: Validates the timeframe string and calls `analytics_service.get_overview_payload`.
    * `POST /analytics/simulate-loan`: A lightweight endpoint that does math and returns a projection without hitting the database.
* **`wallets.py`** *(Update)*
    * `POST /wallets/rebalance-budget`: Triggers the ledger update.

## 5. Routing & Configuration Updates
* **`app/api/v1/api.py`**
    * Import and include the new `analytics` router.
* **`app/core/constants.py`** *(Optional but recommended)*
    * Define the timezone fallback (`UTC+7`) and the valid timeframe enum (`1w`, `1m`, `1y`, `all`) here so they can be imported across schemas and services.
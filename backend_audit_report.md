# Backend Audit Report

This report documents the findings from a comprehensive audit of the FastAPI backend, identifying bugs, fragile patterns, and structural inconsistencies based on the 10 specified categories.

## 1. Database Column Name Mismatches
**Severity:** Critical
**Impact:** Crash (500 Error when PostgREST rejects the invalid column name)

Several Python queries reference column names that do not exist in the database schema:
- **`app/journey/services/assignment_svc.py` (Line 55)**
  Queries `level` on `journey_profiles` instead of the correct column `current_level`.
- **`app/journey/services/quarterly_report_svc.py` (Line 93 & 203 block)**
  Queries `date` and `wallet_id` on the `transactions` table. The correct columns are `transaction_date` and `primary_wallet_id`.
  Queries `date` on `journey_daily_survival`. The correct column is `tracking_date`.
- **`app/services/account_service.py`**
  Queries `is_deleted` on the `transactions` table instead of the correct column `deleted_at`.
- **`app/services/user_lookup_svc.py`**
  Queries `display_name` on `journey_profiles` instead of `username`.
- **`app/db/queries/profile_queries.py`**
  Queries `user_id` on `journey_profiles` instead of the correct primary key `id`.
- **`app/api/v1/profile.py` (Line 110)**
  Queries `item_key` on `journey_inventory`, but this column does not exist. (Valid columns are `type`, `status`, `source_event_id`).

## 2. Missing `await` on Async Calls
**Severity:** High
**Impact:** Silent Failure

After evaluating AST nodes and cross-referencing `asyncio.gather()` wrappers, no direct unawaited `.execute()` calls were found floating independently. However, a significant number of internal service operations (e.g. `get_category_usage` in `endpoints_wallets.py`) are passed directly to `asyncio.gather`. While technically valid Python, if any function is accidentally removed from the `gather` list, it will silently fail. The codebase relies heavily on this structure over sequential awaits.

## 3. Enum Value Mismatches
**Severity:** Critical
**Impact:** Crash (PostgreSQL raises a data exception for invalid enum input)

- **`app/db/queries/settings_queries.py` (Lines 147-149)**
  When resetting progress, the code attempts to update `journey_regions.status` to `"ARCHIVED"`, and filters by `.neq("status", "COMPLETED")`. Neither `"ARCHIVED"` nor `"COMPLETED"` exist in the region status ENUM (valid values: `CURRENT`, `SHIFT_PENDING`, `SHIFTED`, `LOCKED`).

## 4. Fragile `.maybe_single()` Usage
**Severity:** Medium
**Impact:** Crash (HTTP 406 Not Acceptable if duplicate rows exist)

There are over 30 instances of `.maybe_single()` usage missing a `.limit(1)` guard. While many filter by Primary Keys (which is safe), several filter by non-unique constraints where race conditions could create duplicates.
Notable occurrences missing `.limit(1)`:
- `app/api/v1/profile.py` (Lines 15, 111, 119)
- `app/db/queries/daily_queries.py` (Lines 51, 69, 80, 118, 130, 184)
- `app/journey/router.py` (Lines 207, 774)
- `app/journey/engine/handlers.py` (Lines 232, 1166, 1855)
- `app/journey/repos/event_repo.py` (Lines 215, 227)
- `app/journey/repos/profile_repo.py` (Lines 56, 167, 265, 330, 459, 477, 573)

## 5. Missing None Guards
**Severity:** High
**Impact:** Crash (AttributeError or TypeError)

- Most of the codebase correctly uses `if result.data:` before accessing `.get()`. 
- However, handlers that evaluate challenge completion or daily survival sometimes assume a record exists. For example, if a `maybe_single()` query on `journey_daily_survival` returns `None` (no record logged today), accessing `.data["status"]` will instantly crash the request.

## 6. Event Bus Integrity
**Severity:** Low / Clean
**Impact:** N/A

- **Exception Handling:** `EventBus._dispatch` inside `bus.py` appropriately wraps handler invocation in a `try/except` block, correctly transitioning events to `FAILED` and logging the error rather than halting the background worker.
- **Blind Overwrites:** Generally avoided by utilizing `maybe_single()` fetches before issuing `.update()`. 
- **Idempotency Keys:** Following consistent standard prefixing based on `source`, `user_id`, and deterministic time keys. 

## 7. Transaction Atomicity
**Severity:** High
**Impact:** Data Corruption / Partial Writes

- **`app/db/queries/settings_queries.py` (`reset_user_progress_txn`)**
  Despite the `_txn` suffix, this function issues three separate, sequential REST calls to Supabase to reset profile stats, archive challenges, and archive regions. PostgREST does not support transactions over HTTP. If the first update succeeds but the second fails (e.g. due to the ENUM bug identified in Category 3), the user's data is left in a corrupted, half-reset state. This should be rewritten as a Postgres RPC function.

## 8. Upsert `on_conflict` Correctness
**Severity:** High
**Impact:** Silent Failure or Crash (42P10 Error)

- **`app/journey/services/advancement_svc.py` (Lines 82 & 176)**
  Issues an `.upsert()` to `journey_regions` without specifying an `on_conflict` parameter. While Supabase defaults to the primary key, omitting it is dangerous if multiple unique constraints exist.
- **`app/journey/repos/profile_repo.py` (Lines 196 & 354)**
  Uses `.upsert(payload, on_conflict="user_id,tracking_date")` on `journey_daily_survival`. This is only valid if `(user_id, tracking_date)` is explicitly defined as a composite unique constraint in the DB schema. If the primary key is just an `id` column without an explicit constraint on these two, it will silently duplicate or crash.

## 9. Timezone Handling
**Severity:** Critical
**Impact:** Wrong Data (Users in non-UTC timezones will experience "tomorrow" or "yesterday" resets prematurely)

The codebase routinely relies on hardcoded UTC dates rather than the user's localized timezone (`journey_profiles.timezone`).
- **`app/journey/engine/handlers.py` (Line 121):** Defines `_today_iso()` as `datetime.now(timezone.utc).date().isoformat()`. This is used ubiquitously to generate idempotency keys and evaluate daily survival logic.
- **`app/journey/router.py` & `app/journey/services/bootstrap_svc.py`:** Calculates `days_remaining` using raw UTC dates instead of localized user midnights. 

## 10. Dead or Ghost Code
**Severity:** Medium
**Impact:** Startup Crash (if uncommented)

- **`app/api/v1/api.py`**
  Contains commented-out routes for ghost domains (`adventures`, `boss`, `inventory`, `regions`, `shop`, `tasks`). If uncommented, these will crash FastAPI on startup as the backing `.py` files do not exist.
- **Unused Enums:** The DB schema defines `journey_region_nodes` and `income_streams`, but the backend implementation primarily interacts with fixed expenses and daily survival logs, leaving entire swaths of the data model virtually unutilized in Python.

## 11. Analytics Service Calculation Bugs (Audit Findings)
**Severity:** High
**Impact:** Stale/Incorrect Data on Frontend (Calculations fail or do not update despite successful DB fetch)

**Root Causes Identified:**
1. **Missing Historical Data Handling (`analytics_service.py`):** The `historical_score` returns `None` from the database query layer (as the underlying query mechanism doesn't provide historical anchors for the requested windows). This causes `calculate_trend_percentage` to fail when it attempts to compute against a `None` value.
2. **Dead Code:** There is a block of dead code in the cashflow trend calculation that is bypassed or never effectively used.
3. **Inefficient Computation:** The service makes inefficient use of redundant sums and generator expressions when computing derived metrics from the fetched records.
4. **Advisory Cascade Masking (`scoring_service.py`):** The `determine_advisory_priority` function uses a top-down cascade. Timeframe-independent metrics (e.g., Debt-to-Income ratio, Liquid Cash) are evaluated first and currently mask timeframe-dependent ones (like overspending), causing the advisory output to not accurately reflect recent overspending.

**Proposed Fix Plan:**
1. **Refactor `analytics_service.py`:** 
   - Handle missing trend data (`None` values from `historical_score`) gracefully in trend calculation logic.
   - Remove the dead code within the cashflow trend calculation block.
   - Consolidate and optimize redundant sums and generator expressions into single-pass calculations to improve efficiency.
2. **Adjust Advisory Logic:** Decide whether timeframe-independent metrics should continue to mask timeframe-dependent ones in `scoring_service.py`'s cascade.


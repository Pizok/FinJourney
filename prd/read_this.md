# FinJourney Backend — Agent Working Rules

This document defines the rules, restrictions, and patterns the agent must follow when working on the FinJourney backend. These are not suggestions — deviating from them has caused data corruption, silent failures, and cascading 500 errors in this project before.

---

## 1. Schema Is the Source of Truth

Before writing any query, cross-reference the actual database schema file. Never assume a column name from context or variable names in existing Python code — the existing code has been proven to contain wrong column names.

The confirmed correct column names for commonly confused fields are:

- `journey_profiles` primary key is `id`, not `user_id`
- `transactions` uses `primary_wallet_id`, not `wallet_id`
- `transactions` uses `transaction_date`, not `date`
- `transactions` uses `deleted_at`, not `is_deleted`
- `journey_profiles` uses `current_level`, not `level`
- `journey_profiles` uses `username`, not `display_name`
- `journey_daily_survival` uses `tracking_date`, not `date`
- `savings_targets` uses `monthly_contribution_target`, not `monthly_contribution`
- `journey_inventory` valid columns are `type`, `status`, `activated_at`, `expires_at`, `source_event_id` — there is no `item_key`

When in doubt, look at the schema file first. Do not guess.

---

## 2. Enum Values Are Case-Sensitive and Strictly Typed

PostgreSQL enums are case-sensitive. Using a lowercase value where the enum expects uppercase will crash the request with a data exception. Always use the exact casing defined in the schema.

Confirmed valid enum values by table:

- `journey_challenges.status`: PREPARING, ACTIVE, COMPLETED, ARCHIVED, FAILED
- `journey_regions.status`: CURRENT, SHIFT_PENDING, SHIFTED, LOCKED
- `journey_inventory.status`: AVAILABLE, ACTIVE, CONSUMED, EXPIRED
- `journey_events.status`: CREATED, PROCESSING, PROCESSED, FAILED
- `transactions.type`: expense, income, transfer
- `transactions.payment_method`: cash, debit_card, credit_card, transfer, qr_code
- `wallets.type`: cash, bank, credit, savings, investment, e_wallet
- `loans.status`: ACTIVE, PAID, RESTRUCTURED

Never use lowercase for journey engine enums. Never use uppercase for transaction and wallet enums. If a new enum value is needed, it must be added to the database first via SQL before being used in Python.

---

## 3. Never Write Multi-Step Operations Without Atomicity

If an operation requires more than one database write, it must be atomic. PostgREST does not support transactions over HTTP — sequential Supabase client calls are not atomic and will leave the database in a corrupted half-written state if any step fails.

Rules:

- Any operation that touches two or more tables must be wrapped in a Postgres RPC function using a `BEGIN / COMMIT` block, then called from Python via `client.rpc()`.
- Never issue sequential `.update()` or `.insert()` calls across multiple tables and assume they will all succeed.
- The `_txn` suffix on a Python function name does not make it transactional. Only a real Postgres RPC guarantees atomicity.
- If adding a new multi-table operation, write the SQL function first, test it directly in the Supabase SQL Editor, then call it from Python.

---

## 4. All Date Comparisons Must Use the User's Local Timezone

The application stores user timezones in `journey_profiles.timezone` (e.g. `Asia/Jakarta`). Every query that filters by today's date must use the user's local date, not UTC.

Rules:

- Never use `datetime.utcnow()` or `datetime.now(timezone.utc)` for date-based filtering or idempotency key generation.
- Always fetch the user's timezone from `journey_profiles.timezone` before computing today's date.
- Use `datetime.now(ZoneInfo(user_timezone)).date().isoformat()` to get the correct local date string.
- This applies to: daily survival queries, XP idempotency keys, streak calculations, challenge progress evaluation, and any `tracking_date` filter.
- A user in Jakarta (UTC+7) logging a transaction at 11pm local time is on a different calendar date than UTC. Getting this wrong silently corrupts streaks and XP claims.

---

## 5. Every Database Query Result Must Be Null-Checked

Never access fields on a query result without first confirming the result is not None. This applies everywhere but especially in event handlers, where the handler may fire for a user who has no active challenge, no active region, or no daily survival record yet.

The required pattern is:

- Call the query
- Check if the result is None or if `result.data` is None or empty
- If None, log a warning and return early — do not continue processing
- Only access `result.data` fields after confirming the result exists

Never write `result.data["field"]` on the same line as or immediately after a query call without a guard between them. A handler that crashes on None will mark the event as FAILED and silently break XP, HP, and challenge progression for that user.

---

## 6. Rules for `.maybe_single()` Usage

`.maybe_single()` is only safe when the query filters exclusively by a primary key column, guaranteeing at most one row. For any other filter, duplicate rows can exist due to race conditions or bad historical data.

Rules:

- Always add `.limit(1)` immediately before `.maybe_single()` on any query that does not filter by primary key alone.
- Never use `.single()` — it throws a 406 if zero rows are returned. Use `.maybe_single()` instead.
- After any `.maybe_single()` call, always null-check the result before accessing its data.

---

## 7. Upsert Calls Must Always Specify on_conflict Explicitly

Never issue an `.upsert()` call without an explicit `on_conflict` parameter. Relying on Supabase defaults is fragile and has caused 42P10 errors in this project before.

Rules:

- The `on_conflict` value must be a comma-separated string of column names with no spaces, matching either the primary key or a confirmed unique constraint on that table.
- For `journey_daily_survival`, use `on_conflict="user_id,tracking_date"` — the composite primary key is confirmed as these two columns.
- For all other tables with a single `id` primary key, use `on_conflict="id"`.
- Before writing any new upsert, confirm the target columns are actually unique-constrained in the schema.

---

## 8. Event Bus Rules

All game engine side effects (XP, HP, challenges, inventory) must go through the event bus in `bus.py`. Never write directly to `journey_profiles.total_xp`, `current_hp`, or `defense_shield` from an endpoint handler or service — always publish an event and let the bus dispatch it to the correct handler.

Rules:

- Every event must have a unique `idempotency_key` to prevent double-processing. The format is `{EVENT_TYPE}_{user_id}_{local_date}` for daily events, or `{EVENT_TYPE}_{entity_id}` for entity-scoped events.
- Handlers must be wrapped in try/except. Any exception must mark the event as FAILED with the error written to `error_log`, never crash the parent request.
- Handlers must read the existing record before modifying it. Never blindly overwrite a JSONB field — always fetch, modify in Python, then write back.
- Publishing events from endpoints is forbidden. Events must be published from the service layer only.

---

## 9. Ghost Routes Must Stay Commented Out

The following route modules are referenced in `api.py` but do not exist as files. They must remain commented out. Uncommenting any of them will crash FastAPI on startup with an import error.

Ghost routes: adventures, boss, inventory, regions, shop, tasks.

If any of these features need to be built, create the backing `.py` file first, implement and test it, then uncomment the route registration last.

---

## 10. Before Touching Any File

Before editing any backend file, the agent must:

- Read the file in full first — never edit based on a partial view
- Check the schema file to confirm every column name used in any new or modified query
- Confirm enum values match the exact casing in the schema
- Restart the FastAPI server after any change and confirm it boots without import errors before declaring the fix done
- After any bug fix, generate a fresh event by performing the relevant action in the UI, then query `journey_events` filtered to the last 10 minutes to confirm the event shows PROCESSED and not FAILED

Do not declare a fix complete based on code inspection alone. Always verify with a live test.
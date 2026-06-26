# FinJourney Backend Integrity Report
> **Scope:** `src/app/{api,core,db,schemas,services}` — all `.py` files  
> **Date:** 2026-06-18

---

## 🔴 Critical Issues (Will Break at Runtime)

### 1. `api/v1/api.py` — Imports Non-Existent `endpoints/` Package
The central router imports from `app.api.v1.endpoints.*`, but that subdirectory **does not exist**. The actual files are directly in `app/api/v1/`.

```python
# api.py line 26-41 — BROKEN
from app.api.v1.endpoints import (
    adventures, analytics, auth, boss, categories,
    daily, inventory, loans, profile, regions,
    shop, tasks, transactions, wallets,
)
```

**What exists in `api/v1/`:** `api.py`, `bootstrap.py`, `categories.py`, `daily.py`, `dependencies.py`, `endpoints_analytics.py`, `endpoints_wallets.py`, `profile.py`, `transactions.py`

**Missing modules entirely:** `adventures`, `auth`, `boss`, `inventory`, `loans`, `regions`, `shop`, `tasks`, `wallets` — **9 of 14 routers do not exist**.

---

### 2. `api/v1/transactions.py` — Wrong Dependency Aliases + Wrong Auth Pattern
```python
# Line 3 — imports non-existent aliases
from app.api.v1.dependencies import CurrentUser, DbClient
```
`dependencies.py` exports `AuthUser` and `DBClient` (not `CurrentUser`/`DbClient`). The correct aliases are defined at the bottom of `dependencies.py`.

Additionally, the endpoint accesses `user["id"]` (dict-style), but `dependencies.py` returns a **`CurrentUser` dataclass** where the field is `user.user_id`:
```python
# transactions.py line 27 — WRONG
user_id=user["id"]   # CurrentUser is a dataclass, not a dict
```
This will raise `TypeError` on every call.

---

### 3. `api/v1/profile.py` — Same Wrong Aliases + Dict Access Pattern
Same issue as `transactions.py`: should be `AuthUser, DBClient`. Also accesses `user["id"]` (dict-style) throughout instead of `user.user_id`.

---

### 4. `api/v1/bootstrap.py` — Same Wrong Aliases + Dict Access
Imports `CurrentUser, DbClient` and uses `user["id"]` instead of `user.user_id`.

---

### 5. `api/v1/daily.py` — Same Wrong Aliases + Dict Access
Imports `CurrentUser, DbClient`. All handlers use `user["id"]` (dict-style).

---

### 6. `endpoints_analytics.py` — Imports Non-Existent `app.core.dependencies`
```python
# Line 50 — BROKEN
from app.core.dependencies import get_current_user, get_db
```
`app/core/` only has `config.py`, `constants.py`, `security.py`, `__init__.py`. There is **no `dependencies.py`** in `app/core/`. The dependency functions live in `app/api/v1/dependencies.py`.

Also imports `asyncpg` — architecturally inconsistent with the Supabase stack.

---

### 7. `endpoints_wallets.py` — Same Wrong Core Import + asyncpg Inconsistency
```python
from app.core.dependencies import get_current_user, get_db  # BROKEN
```
Also uses `asyncpg.Connection` which is inconsistent with the Supabase client stack.

---

### 8. `services/wallet_service.py` — Uses asyncpg While Other Services Use Supabase
`wallet_service.py` accepts `asyncpg.Connection` but all other services use `supabase.AsyncClient` / `supabase.Client`. `rebalance_budget` **cannot be called** with the Supabase client.

---

### 9. `services/transaction_service.py` — Imports Non-Existent Modules
```python
import app.db.queries.wallet_queries as wal_q           # BROKEN
from app.db.queries.category_queries import get_category_by_id  # BROKEN
```
Neither file exists in `app/db/queries/`. Those files live in `app/schemas/` (misplaced).

---

### 10. `services/transaction_service.py` — Sync/Async Mismatch
`transaction_service.py` accepts `supabase.Client` (sync), while `transaction_queries.py` uses `supabase.AsyncClient` (async) — mixing sync and async in the same request pipeline.

---

### 11. `api/v1/transactions.py` — Schema Name Mismatch
```python
from app.schemas.transaction import TransactionCreateRequest  # BROKEN
```
Actual class name is **`TransactionCreate`** (not `TransactionCreateRequest`). `ImportError` on startup.

---

### 12. `db/queries/analytics_queries.py` — Uses asyncpg Against Supabase Stack
All query functions accept `asyncpg.Connection` and use `db.fetch()` / `db.fetchrow()`. The Supabase `AsyncClient` does not have these methods.

---

### 13. `db/queries/savings_targets_queries.py` — Same asyncpg vs Supabase Mismatch
Same problem: accepts `asyncpg.Connection`, uses `db.fetch()` / `db.fetchrow()`.

---

## 🟡 Structural / Architectural Issues

### 14. `endpoints_wallets.py` — Contains `raise NotImplementedError` Stubs
`list_wallets` and `create_wallet` will crash if called.

---

### 15. `services/wallet_service.py` — Stub Comment, Missing CRUD Functions
Only `rebalance_budget` is present. All CRUD functions (create/update/delete/get wallets) are absent — the `categories.py` endpoint calls them and will crash with `AttributeError`.

---

### 16. `api/v1/categories.py` — Calls Missing Functions on wallet_service
Calls `wallet_service.get_categories()`, `create_category()`, `update_category()`, `delete_category()` — none of these exist in the current `wallet_service.py`.

---

### 17. Two Parallel DB Client Strategies Are Incompatible

| Files | DB Strategy |
|---|---|
| `db/supabase.py`, `{daily,profile,transaction}_queries.py`, `{bootstrap,transaction}_service.py` | `supabase.AsyncClient` / PostgREST |
| `{analytics,savings_targets}_queries.py`, `wallet_service.py` | `asyncpg.Connection` / raw SQL |

There is no single `get_db` that satisfies both. These two generations were never reconciled.

---

### 18. `core/security.py` — Redundant JWT Verification
`security.py` uses `settings.supabase_jwt_secret` while `dependencies.py` reads `os.environ["SUPABASE_JWT_SECRET"]` directly — two divergent JWT validation paths.

---

### 19. `services/transaction_service.py` — Daily Bleed Pipeline Commented Out
```python
# budget_service.apply_daily_bleed(client=client, user_id=user_id)
pass  # Remove when budget_service is wired in.
```
Core game mechanic (HP loss from overspend) is disabled.

---

### 20. `api/v1/daily.py` — `asyncio` Import at Module Bottom
PEP 8 violation — `import asyncio` buried mid-file below route handlers.

---

### 21. `schemas/analytics.py` — `CategoryBreakdownItem.category_id` Not Optional
```python
category_id: UUID   # not Optional
```
But `analytics_queries.get_category_breakdown()` returns `category_id = NULL` for the synthetic "Other" row → Pydantic validation failure.

---

## 🟢 Files in Good Shape

| File | Status |
|---|---|
| `core/config.py` | ✅ Clean |
| `core/constants.py` | ✅ Well-structured, properly typed |
| `services/budget_service.py` | ✅ Pure functions, no import issues |
| `services/progression_service.py` | ✅ Pure math, clean |
| `services/scoring_service.py` | ✅ Well-structured, zero DB calls |
| `schemas/transaction.py` | ✅ Solid Pydantic v2 with good validators |
| `schemas/wallet.py` | ✅ Clean |
| `schemas/analytics.py` | ✅ Well-defined (minor issue #21) |
| `db/supabase.py` | ✅ Clean singleton pattern |
| `db/queries/transaction_queries.py` | ✅ Consistent with Supabase stack |
| `db/queries/daily_queries.py` | ✅ Consistent with Supabase stack |
| `db/queries/profile_queries.py` | ✅ Consistent |

---

## Summary Table

| # | Severity | File | Issue |
|---|---|---|---|
| 1 | 🔴 | `api/v1/api.py` | Imports non-existent `endpoints/` package; 9 routers missing |
| 2 | 🔴 | `api/v1/transactions.py` | Wrong aliases + dict access + wrong schema name |
| 3 | 🔴 | `api/v1/profile.py` | Wrong aliases + dict access |
| 4 | 🔴 | `api/v1/bootstrap.py` | Wrong aliases + dict access |
| 5 | 🔴 | `api/v1/daily.py` | Wrong aliases + dict access |
| 6 | 🔴 | `endpoints_analytics.py` | Imports `app.core.dependencies` (does not exist) |
| 7 | 🔴 | `endpoints_wallets.py` | Same missing core import |
| 8 | 🔴 | `services/wallet_service.py` | asyncpg vs Supabase mismatch |
| 9 | 🔴 | `services/transaction_service.py` | Imports `wallet_queries`, `category_queries` that don't exist |
| 10 | 🔴 | `services/transaction_service.py` | Sync Supabase calls in async pipeline |
| 11 | 🔴 | `api/v1/transactions.py` | `TransactionCreateRequest` → should be `TransactionCreate` |
| 12 | 🔴 | `db/queries/analytics_queries.py` | asyncpg methods on Supabase client |
| 13 | 🔴 | `db/queries/savings_targets_queries.py` | asyncpg on Supabase client |
| 14 | 🟡 | `endpoints_wallets.py` | `raise NotImplementedError` stubs |
| 15 | 🟡 | `services/wallet_service.py` | CRUD functions absent |
| 16 | 🟡 | `api/v1/categories.py` | Calls missing wallet_service functions |
| 17 | 🟡 | Whole codebase | Two incompatible DB client strategies |
| 18 | 🟡 | `core/security.py` | Redundant JWT check |
| 19 | 🟡 | `services/transaction_service.py` | Daily Bleed pipeline commented out |
| 20 | 🟢 | `api/v1/daily.py` | `asyncio` import at wrong position |
| 21 | 🟡 | `schemas/analytics.py` | `CategoryBreakdownItem.category_id` not Optional |

# FinJourney — Backend Map & Function Registry
> Root: `frontend/app/`  
> DB client: **Supabase** (`supabase.AsyncClient` for async, `supabase.Client` for sync)  
> Auth: `AuthUser` / `DBClient` type aliases from `app.api.v1.dependencies`

---

## Canonical Patterns

### Auth + DB injection in an endpoint
```python
from app.api.v1.dependencies import AuthUser, DBClient

@router.get("/your-route")
async def handler(user: AuthUser, db: DBClient):
    # user.user_id  → str UUID
    # user.level    → int player level
```

### Standard envelopes
```python
return {"success": True, "data": <payload>}                          # success
raise HTTPException(status_code=404, detail="message")               # error
```

---

## 📁 `app/api/v1/`

### `dependencies.py`
| Symbol | Kind | Description |
|---|---|---|
| `CurrentUser` | dataclass | `user_id: str`, `level: int` |
| `get_db_client()` | fn | Returns Supabase anon client |
| `get_current_user(credentials)` | fn | Validates JWT → CurrentUser |
| `AuthUser` | alias | `Annotated[CurrentUser, Depends(get_current_user)]` |
| `DBClient` | alias | `Annotated[Client, Depends(get_db_client)]` |

> ⚠️ Always use `AuthUser` / `DBClient` — never `CurrentUser` or `DbClient`.

---

### `api.py` — Central Router
Add new routers here: `api_router.include_router(...)`.  
Registered (many point to missing files): `auth`, `profile`, `categories`, `daily`, `loans`, `transactions`, `wallets`, `analytics`, `adventures`, `boss`, `regions`, `tasks`, `inventory`, `shop`

---

### `bootstrap.py`
| Route | Handler |
|---|---|
| `GET /me/bootstrap` | `bootstrap(user, db)` → `bootstrap_service.build_bootstrap_payload` |

### `profile.py`
| Route | Handler |
|---|---|
| `GET /profile` | `get_profile(user, db)` |
| `PATCH /profile/setup` | `setup_profile(user, db, payload)` |
| `PATCH /profile/theme` | `update_theme(user, db, payload)` |

### `categories.py`
| Route | Handler |
|---|---|
| `GET /categories` | `list_categories(user, db)` |
| `POST /categories` | `create_category(payload, user, db)` |
| `PATCH /categories/{id}` | `update_category(id, payload, user, db)` |
| `DELETE /categories/{id}` | `delete_category(id, user, db)` |

### `transactions.py`
| Route | Handler |
|---|---|
| `GET /transactions` | `get_transactions(user, db, limit, offset, wallet_id, category_id, type)` |
| `POST /transactions` | `post_transaction(user, db, payload)` |
| `DELETE /transactions/{id}` | `remove_transaction(user, db, id)` |

### `daily.py`
| Route | Handler |
|---|---|
| `GET /daily-status` | `get_daily_status(user, db)` |
| `POST /daily/zero-spend` | `mark_zero_spend(user, db)` |
| `POST /daily/use-standby` | `use_standby(user, db)` |

### `endpoints_analytics.py` ⚠️ broken imports
| Route | Handler |
|---|---|
| `GET /analytics/overview?timeframe=` | `get_analytics_overview(timeframe, db, current_user)` |
| `POST /analytics/simulate-loan` | `simulate_loan(body, current_user)` |

### `endpoints_wallets.py` ⚠️ broken imports + stubs
| Route | Handler | Status |
|---|---|---|
| `GET /wallets` | `list_wallets` | stub |
| `POST /wallets` | `create_wallet` | stub |
| `POST /wallets/rebalance-budget` | `rebalance_budget` | ✅ |

---

## 📁 `app/core/`

### `config.py`
```python
from app.core.config import settings
# settings.supabase_url / supabase_service_key / supabase_jwt_secret / environment
```

### `constants.py` — All business thresholds (never hardcode in endpoints)
| Constant | Value |
|---|---|
| `ANALYTICS_REQUIRED_LEVEL` | 3 |
| `WALLET_CREATION_MIN_LEVEL` | 3 |
| `TASK_CREATION_MIN_LEVEL` | 2 |
| `HP_DAILY_BLEED_CAP` | 30 |
| `HP_GHOST_PENALTY_DAILY` | 10 |
| `STANDBY_TOKENS_PER_YEAR` | 7 |
| `DTI_CRITICAL_THRESHOLD_PCT` | 35.0 |
| `CATEGORY_OVERSPEND_THRESHOLD_PCT` | 110.0 |
| `RUNWAY_EXCELLENT_MONTHS` | 6.0 |
| `DEFAULT_TIMEZONE` | "Asia/Jakarta" |
| `GameEvent` | Enum: `DAILY_BLEED`, `CLEAN_CODE`, `GHOST_PENALTY`, `LEVEL_UP`, `BOSS_DEFEATED`, `REGION_SHIFT`, `LOAN_CLEARED`, `STANDBY_USED`, `THEME_UNLOCKED`, `BUDGET_REBALANCE` |
| `ErrorCode` | Enum: `INVALID_TIMEFRAME`, `CATEGORY_NOT_FOUND`, `INSUFFICIENT_LEVEL`, `INSUFFICIENT_GOLD`, `WALLET_LIMIT_REACHED`, `CATEGORY_LIMIT_REACHED`, `INVALID_TRANSACTION`, `FUTURE_TRANSACTION`, `DUPLICATE_ZERO_SPEND`, `STANDBY_EXHAUSTED`, `OWNERSHIP_VIOLATION` |

### `security.py`
| fn | Description |
|---|---|
| `verify_supabase_jwt(token)` | Decodes JWT, raises HTTP 401. Use only outside FastAPI DI. |

---

## 📁 `app/db/`

### `supabase.py` — service-role client (bypasses RLS)
| fn | Description |
|---|---|
| `init_supabase()` | Call on startup |
| `get_db()` | Returns singleton AsyncClient |

---

## 📁 `app/db/queries/`

### `profile_queries.py` — `AsyncClient, user_id: str`
| fn | Returns |
|---|---|
| `fetch_profile(db, user_id)` | Profile row or None |
| `fetch_player_state(db, user_id)` | hp, xp, gold, shield, standby_tokens, tax_state |
| `fetch_wallets(db, user_id)` | Active wallets list |
| `fetch_categories(db, user_id)` | Active categories list |

### `daily_queries.py`
| fn | Returns |
|---|---|
| `fetch_daily_status(db, user_id, tz_name)` | `{spent_today, zero_spend_marked, date_local}` |
| `fetch_streak(db, user_id)` | int |
| `fetch_baselines(db, user_id)` | `{monthly_income, fixed_costs, savings_target}` or None |
| `fetch_tasks(db, user_id)` | list |
| `fetch_active_region(db, user_id)` | dict or None |
| `upsert_daily_snapshot(db, user_id, date, updates)` | None |

### `transaction_queries.py`
| fn | Returns |
|---|---|
| `insert_transaction(db, user_id, wallet_id, category_id, tx_type, amount, note, logged_at)` | dict |
| `insert_game_event(db, user_id, event_type, xp_delta, hp_delta, gold_delta, shield_delta, source_id, metadata)` | dict |
| `update_player_state(db, user_id, hp, xp, gold, shield, standby_tokens, extra)` | dict |
| `fetch_transaction_by_id(db, tx_id, user_id)` | dict or None |
| `soft_delete_transaction(db, tx_id, user_id)` | None |
| `fetch_transactions(db, user_id, limit, offset, wallet_id, category_id, tx_type)` | list |

### `analytics_queries.py` ⚠️ asyncpg — needs reconciliation
| fn | Returns |
|---|---|
| `get_cashflow_series(db, *, user_id, start_date, end_date, granularity, user_tz)` | list[Record] |
| `get_category_breakdown(db, *, user_id, start_date, end_date)` | list[Record] |
| `get_top_transactions(db, *, user_id, start_date, end_date)` | list[Record] |
| `get_monthly_debt_payments(db, *, user_id, month_date)` | int |
| `get_avg_monthly_debt_payments(db, *, user_id, lookback_months)` | int |
| `get_wallet_snapshot(db, *, user_id)` | Record |
| `get_historical_stability_score(db, *, user_id, target_date)` | int or None |
| `get_active_baseline(db, *, user_id)` | Record or None |
| `get_player_access(db, *, user_id)` | Record |

### `savings_targets_queries.py` ⚠️ asyncpg
| fn | Returns |
|---|---|
| `get_active_savings_targets(db, *, user_id)` | list[Record] |
| `get_savings_target_by_id(db, *, user_id, target_id)` | Record or None |

---

## 📁 `app/schemas/`

### `profile.py`
| Schema | Fields |
|---|---|
| `ProfileSetupRequest` | username, avatar_class, timezone |
| `ProfileThemeRequest` | theme_key |
| `ProfileOut` | id, username, avatar_class, level, hp, xp, gold, shield |

### `bootstrap.py`
| Schema | Fields |
|---|---|
| `PlayerStateSchema` | hp, xp, level, gold, shield, standby_tokens, tax_state |
| `DailyStatusSchema` | daily_budget, spent_today, remaining_budget, streak_count, zero_spend_marked |
| `WalletSchema` | id, name, icon, balance |
| `CategorySchema` | id, name, icon, category_group |
| `TaskSchema` | id, title, objective_type, target_value, reward_xp, reward_gold, repeat_type, completed_today, narrative_text |
| `FeatureUnlocksSchema` | can_use_icons, can_create_custom_tasks, can_delete_default_tasks, can_access_analytics, can_create_unlimited_wallets, can_create_unlimited_categories |
| `BootstrapData` | Full hydration payload |

### `transaction.py`
| Schema | Notes |
|---|---|
| `TransactionType` | Enum: income, expense, transfer |
| `TransactionStatus` | Enum: active, deleted |
| `PaymentMethod` | Enum: cash, debit_card, credit_card, e_wallet, other |
| `TransactionCreate` | POST body — full type-conditional validation |
| `TransactionUpdate` | PATCH body — partial, at least 1 field |
| `TransactionOut` | Response |
| `TransactionListResponse` | Paginated list |

### `category.py`
| Schema | Notes |
|---|---|
| `CategoryCreate` | name, monthly_limit |
| `CategoryUpdate` | partial, at least 1 field |
| `CategoryOut` | id, user_id, name, monthly_limit, created_at |

### `wallet.py`
| Schema | Notes |
|---|---|
| `WalletType` | Enum: cash, bank, savings, investment, credit |
| `WalletCreate` | name, wallet_type, icon |
| `WalletOut` | id, user_id, name, wallet_type, icon, balance |
| `CategoryBudgetAdjustment` | category_id, new_monthly_limit |
| `RebalanceBudgetRequest` | list of adjustments (min 1) |

### `wallet_summary.py`
| Schema | Notes |
|---|---|
| `LevelRestrictions` | max_wallets, max_categories, can_create_wallet, can_create_category |
| `CategoryUsage` | category_id, name, spent, limit, remaining, percentage, is_overspent |
| `WalletSummaryResponse` | total_balance, wallet_count, category_count, wallets, category_usage, level_restrictions |

### `analytics.py`
| Schema | Notes |
|---|---|
| `Timeframe` | Enum: 1w, 1m, 1y, all |
| `Granularity` | Enum: daily, monthly |
| `AdvisoryPriority` | Enum: critical_debt, upcoming_payment, overspending, savings_target, optimization |
| `DebtStatus` | Enum: good, warning, critical |
| `UnlockStatus` | unlocked, required_level, current_level, xp_remaining |
| `FinancialStability` | score, score_version, score_trend, explanation |
| `SuggestedAction` | category_id, category_name, reduction_amount |
| `Advisory` | priority, headline, recommendation, suggested_actions |
| `Cashflow` | has_data, granularity, trend_percentage, series[CashflowDataPoint] |
| `IncomeAllocation` | has_income, total_income, baseline_costs, variable_spending, remaining_amount |
| `CategoryBreakdown` | has_category_data, categories[CategoryBreakdownItem] |
| `DebtHealth` | dti_percentage, status, active_loans, safe_loan_limit, debt_free_date, debt_free_date_reason |
| `AssetHealth` | liquid_cash, net_liquid_cash, invested_assets, has_investments, survival_runway_months, savings_target |
| `AnalyticsOverviewResponse` | Full overview payload |
| `SimulateLoanRequest` | remaining_debt, monthly_payment, annual_interest_rate |
| `SimulateLoanResponse` | is_payable, projected_months, debt_free_date, total_interest_paid |

### `savings_targets.py`
| Schema | Notes |
|---|---|
| `SavingsTargetStatus` | Enum: active, completed, archived |
| `SavingsTargetCreate` | name, target_amount, current_amount, deadline |
| `SavingsTargetUpdate` | partial update |
| `SavingsTargetOut` | Full row |

### `category_queries.py` ⚠️ Misplaced (should be in `db/queries/`), sync Client
| fn | Returns |
|---|---|
| `get_categories_by_user(client, user_id)` | list[dict] |
| `get_category_by_id(client, category_id, user_id)` | dict or None |
| `get_category_usage(client, user_id, wallet_id?)` | list[dict] with spent/limit/remaining/percentage/is_overspent |
| `insert_category(client, user_id, name, monthly_limit)` | dict |
| `update_category(client, category_id, user_id, updates)` | dict |
| `soft_delete_category(client, category_id, user_id)` | None |

### `wallet_queries.py` ⚠️ Misplaced (should be in `db/queries/`), sync Client
| fn | Returns |
|---|---|
| `get_wallets_by_user(client, user_id)` | list[dict] |
| `get_wallet_by_id(client, wallet_id, user_id)` | dict or None |
| `get_wallet_summary(client, user_id)` | `{total_balance, wallet_count, wallets}` |
| `insert_wallet(client, user_id, name, wallet_type, balance, color_token)` | dict |
| `update_wallet(client, wallet_id, user_id, updates)` | dict (name/color_token only) |
| `apply_balance_delta(client, wallet_id, user_id, delta)` | dict — **only way to change balance** |
| `soft_delete_wallet(client, wallet_id, user_id)` | None |

---

## 📁 `app/services/`

### `bootstrap_service.py`
| fn | Description |
|---|---|
| `build_bootstrap_payload(db: AsyncClient, user_id)` | 2-phase parallel fetch for dashboard |

### `budget_service.py` — Pure functions, no DB
| fn | Returns |
|---|---|
| `calculate_daily_budget(monthly_income, fixed_costs, savings_target)` | float |
| `overspend_ratio(spent, budget)` | float |
| `calculate_hp_loss(spent, budget)` | float |
| `calculate_shield_gain(remaining, budget)` | float |
| `apply_daily_bleed(current_hp, current_shield, spent, budget)` | BleedResult |

`BleedResult`: overspent, hp_loss, shield_consumed, net_hp_damage, hp_before, hp_after, new_shield

### `progression_service.py` — Pure functions, no DB
| fn | Returns |
|---|---|
| `calculate_level(total_xp)` | int |
| `is_danger_state(hp, max_hp=100)` | bool (HP < 30%) |
| `is_ghost_penalty_active(days_since_last_tx)` | bool (≥3 days) |
| `get_feature_unlocks(level)` | dict |
| `xp_for_transaction(tx_type)` | float — expense:5, income:10, transfer:0 |

### `scoring_service.py` — Pure math, no DB, no Pydantic
| fn | Returns |
|---|---|
| `calculate_financial_stability(*, total_income_in_window, total_expense_in_window, dti_pct, runway_months, categories)` | StabilityScore |
| `determine_advisory_priority(*, dti_pct, liquid_cash, baseline_costs, categories, is_savings_target_behind)` | AdvisoryResult |
| `calculate_debt_free_date(*, remaining_debt, avg_monthly_payment)` | DebtFreeProjection |
| `is_savings_behind_schedule(*, actual_progress_pct, days_elapsed, total_days)` | bool |
| `calculate_trend_percentage(*, current_period, previous_period)` | float or None |
| `calculate_score_trend(*, current_score, historical_score)` | int |

Output dataclasses: `StabilityScore`, `AdvisoryResult`, `DebtFreeProjection`, `SuggestedAction`, `CategoryInput`

### `transaction_service.py` — sync Client (⚠️ needs async fix)
| fn | Returns |
|---|---|
| `create_transaction(client, user_id, payload: TransactionCreate)` | TransactionOut |
| `update_transaction(client, transaction_id, user_id, payload)` | TransactionOut |
| `delete_transaction(client, transaction_id, user_id)` | None |
| `list_transactions(client, user_id, page, limit, wallet_id, category_id, txn_type)` | TransactionListResponse |
| `get_transaction(client, transaction_id, user_id)` | TransactionOut |

### `analytics_service.py` — ⚠️ asyncpg, needs reconciliation
| fn | Returns |
|---|---|
| `get_overview_payload(db, *, user_id, timeframe_str, user_tz)` | AnalyticsOverviewResponse |

### `wallet_service.py` — ⚠️ asyncpg, CRUD absent
| fn | Returns |
|---|---|
| `rebalance_budget(db, *, user_id, payload: RebalanceBudgetRequest)` | dict |

---

## 🗂️ Missing Files (Safe to Create)

| File | Purpose |
|---|---|
| `app/api/v1/auth.py` | Login / logout / refresh token |
| `app/api/v1/wallets.py` | Full wallet CRUD |
| `app/api/v1/savings_targets.py` | Savings target CRUD (schema ready) |
| `app/api/v1/adventures.py` | Adventure map |
| `app/api/v1/boss.py` | Boss battle |
| `app/api/v1/loans.py` | Loan management |
| `app/api/v1/regions.py` | Region catalog + unlock |
| `app/api/v1/tasks.py` | Task CRUD + completion |
| `app/api/v1/inventory.py` | User inventory |
| `app/api/v1/shop.py` | Guild shop |
| `app/db/queries/wallet_queries.py` | Move from schemas/ → here |
| `app/db/queries/category_queries.py` | Move from schemas/ → here |

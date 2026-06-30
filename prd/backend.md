# Backend Architecture & Structure

This document serves as a concise context for AI agents regarding the FinJourney backend structure.

## Core Tech Stack
- **Framework**: FastAPI (Python 3)
- **Database**: PostgreSQL (Supabase) with Python REST client (`supabase-py`)
- **Transactional Emails**: Resend SDK + Jinja2 (for HTML templating)
- **Background Jobs / Crons**: Upstash QStash (timezone-aware webhooks)
- **Location**: The Python backend shares the `src/app/` namespace with the Next.js frontend, but is executed as a separate FastAPI server via `main.py`.

## File Structure (`src/app/`)
- `main.py`: The FastAPI application entrypoint. Initializes Supabase connection and mounts routers.
- `api/v1/`: Standard HTTP REST endpoints.
- `journey/`: The isolated Gamification engine (Events, XP, HP, etc.).
- `services/`: Shared business logic layer (e.g., `account.py`, `transaction_service.py`, `analytics_service.py`, `wallet_service.py`).
- `schemas/`: Pydantic models for validation and serialization.
- `core/`: Config (`settings`), constants, and security logic.
- `db/queries/`: Database query modules (`analytics_queries.py`, `daily_queries.py`, etc.).
- `db/supabase.py`: Database connection logic and client singleton.

## Endpoints Summary
### Standard Hub (`/api/v1/*`)
Routed through `api/v1/api.py`.
- **User & Auth**: `profile.py`, `account.py`, `settings.py`, `auth.py`.
- **Data Hydration**: `bootstrap.py` (e.g., `/me/bootstrap` for initial data loads).
- **Core Finance**: `endpoints_wallets.py`, `categories.py`, `transactions.py`, `endpoints_income.py`, `endpoints_savings.py`.
- **Advanced Finance**: `fixed_expenses.py`, `loans.py`, `endpoints_analytics.py`.
- **Daily State**: `daily.py` (zero-spend claims, standby token usage).

### Gamification Engine (`/api/v1/journey/*`)
Routed through `journey/router.py` (mounted directly on `app` in `main.py`).
- Manages game state: HP, XP, Shields, Inventory, Regions, and Challenges.
- **Engine Core**: `journey/engine/bus.py` (event bus logic).
- **Services**: `hp_svc.py`, `xp_svc.py`, `inventory_svc.py`, `cron_svc.py`, `email_svc.py`, `user_lookup_svc.py`.
- **Background/Cron Jobs**: Handled via `POST /cron/*` webhooks triggered by QStash (e.g., midnight evaluations).

## Architectural & API Guidelines
To ensure consistency and integrity when creating new endpoints or modifying connections:
1. **Ghost Domains**: In `api.py`, uncreated routers are commented out. Importing a missing module will crash FastAPI.
2. **Mounting Router**: Feature routers in `api/v1/` are attached to `api_router`. The `journey` router is attached directly to the root `app`.
3. **Database Client**: Use Supabase client imported from `app.db.supabase.get_admin_db`. PostgREST does not support transactions; atomic operations require PostgreSQL RPCs.
4. **Validation & Schemas**: All incoming request bodies and outgoing responses MUST use Pydantic models defined in `app/schemas/` or `app/journey/schemas/`. Do not return raw dictionaries from endpoints.
5. **Business Logic & Separation of Concerns**: Keep route handlers thin. Delegate complex logic to service files (e.g., `services/<feature>_service.py`) and database interactions to query files (`db/queries/<feature>_queries.py`).
6. **Error Handling**: Raise standard `HTTPException`s from FastAPI with appropriate status codes (e.g., 400 for bad request, 404 for not found, 403 for forbidden) to ensure the frontend can predictably handle errors.
7. **Authentication**: All protected endpoints must use the appropriate authentication dependencies (like `get_current_user` if available) to ensure the requester is authenticated and to inject the user context into the endpoint.

## Database Schema Summary
The following core tables and columns are used by the application:

### User & Core Finance
- **`journey_profiles`**: `id`, `username`, `avatar_key`, `active_path`, `has_completed_setup`, `expected_monthly_income`, `monthly_savings_target`, `primary_payday`, `current_hp`, `total_xp`, `current_level`, `vitality`, `current_streak`, `gold_coins`, `defense_shield`, `standby_tokens`, `timezone`
- **`wallets`**: `id`, `user_id`, `name`, `type`, `balance`, `color_token`
- **`categories`**: `id`, `user_id`, `name`, `category_group`, `monthly_limit`
- **`transactions`**: `id`, `user_id`, `primary_wallet_id`, `source_wallet_id`, `destination_wallet_id`, `category_id`, `type`, `amount`, `payment_method`, `status`, `transaction_date`, `savings_target_id`
- **`fixed_expenses`**: `id`, `user_id`, `name`, `amount`, `recurrence_type`, `recurrence_value`
- **`loans`**: `id`, `user_id`, `name`, `status`, `total_amount`, `paid_amount`, `next_due_date`, `monthly_installment`
- **`savings_targets`**: `id`, `user_id`, `name`, `target_amount`, `current_amount`, `priority`, `deadline`, `status`
- **`income_streams`**: `id`, `user_id`, `name`, `amount`

### Gamification (Journey Engine)
- **`journey_daily_survival`**: `user_id`, `tracking_date`, `status`, `expense_xp_claimed`, `income_xp_claimed`, `zero_spend_xp_claimed`, `consecutive_clean_days`
- **`journey_inventory`**: `id`, `user_id`, `type`, `status`, `activated_at`, `expires_at`
- **`journey_events`**: `id`, `user_id`, `event_type`, `source`, `severity`, `status`, `xp_delta`, `hp_delta`, `shield_delta`, `idempotency_key`
- **`journey_challenges`**: `id`, `user_id`, `template_id`, `status`, `started_at`, `ends_at`, `progress_data`, `rewards_claimed`
- **`journey_regions`**: `id`, `user_id`, `region_id`, `status`, `started_at`, `ends_at`
- **`journey_region_nodes`**: `id`, `user_id`, `node_id`, `region_id`, `status`
- **`journey_notifications`**: `id`, `user_id`, `category`, `severity`, `title`, `message`, `status`
- **`journey_journal`**: `id`, `user_id`, `message`, `severity`, `source_event_id`, `created_at`
- **`journey_passport_stamps`**: `id`, `user_id`, `stamp_key`, `earned_at`
- **`journey_unlock_events`**: `id`, `user_id`, `level_reached`, `feature_key`, `shown`, `claimed`

### System
- **`system_flags`**: `key`, `value`

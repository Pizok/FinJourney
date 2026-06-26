# Backend Architecture & Structure

This document serves as a concise context for AI agents regarding the FinJourney backend structure.

## Core Tech Stack
- **Framework**: FastAPI (Python 3)
- **Database**: PostgreSQL (Supabase)
- **Transactional Emails**: Resend SDK + Jinja2 (for HTML templating)
- **Background Jobs / Crons**: Upstash QStash (timezone-aware webhooks)
- **Location**: The backend source code lives inside the Next.js frontend directory, specifically in `src/app/`. (Wait, no, Next.js UI is also there, the Python backend shares the `src/app/` namespace but is executed as a separate FastAPI server from `main.py`).

## File Structure (`src/app/`)
- `main.py`: The FastAPI application entrypoint. Initializes Supabase connection pool and mounts routers.
- `api/v1/`: Standard HTTP REST endpoints.
- `journey/`: The isolated Gamification engine (Events, XP, HP, etc.).
- `services/`: Shared business logic layer (e.g., `account.py`, `transaction_service.py`).
- `schemas/`: Pydantic models for validation and serialization.
- `core/`: Config (`settings`), constants, and security logic.
- `db/`: Database connection logic (`supabase.py`).

## Endpoints Summary
### Standard Hub (`/api/v1/*`)
Routed through `api/v1/api.py`.
- **User & Auth**: `profile.py`, `account.py`, `settings.py`, `auth.py`.
- **Data Hydration**: `bootstrap.py` (e.g., `/me/bootstrap` for initial data loads).
- **Core Finance**: `wallets` (`endpoints_wallets.py`), `categories.py`, `transactions.py`, `endpoints_income.py`, `endpoints_savings.py`.
- **Advanced Finance**: `fixed_expenses.py`, `loans.py`, `endpoints_analytics.py`.
- **Daily State**: `daily.py` (zero-spend claims, standby token usage).

### Gamification Engine (`/api/v1/journey/*`)
Routed through `journey/router.py` (mounted directly on `app` in `main.py`, not via `api_router`).
- Manages game state: HP, XP, Shields, Inventory, Regions, and Challenges.
- **Engine Core**: `journey/engine/bus.py` (event bus logic).
- **Services**: `hp_svc.py`, `xp_svc.py`, `inventory_svc.py`, `cron_svc.py`, `email_svc.py` (Resend wrapper), `user_lookup_svc.py`.
- **Background/Cron Jobs**: Handled via `POST /cron/*` webhooks triggered by QStash (e.g., midnight evaluations, 20:00 evening reminders).

## Architectural Guidelines
1. **Ghost Domains**: In `api.py`, uncreated routers are commented out. Importing a missing module will crash FastAPI.
2. **Mounting Router**: Feature routers in `api/v1/` are attached to `api_router`. The `journey` router is attached directly to the root `app`.
3. **Database Client**: Use Supabase client imported from `app.db.supabase.init_supabase`.
4. **Validation**: All incoming/outgoing data must use models defined in `app/schemas/` or `app/journey/schemas/`.

## Database Schema Summary
The following core tables and columns are used by the application:

### User & Core Finance
- **`journey_profiles`**: `id`, `username`, `avatar_key`, `active_path`, `has_completed_setup`, `expected_monthly_income`, `monthly_savings_target`, `primary_payday`, `current_hp`, `total_xp`, `current_level`, `vitality`, `current_streak`, `gold_coins`, `defense_shield`, `standby_tokens`, `is_dev_account`
- **`wallets`**: `id`, `user_id`, `name`, `type`, `balance`, `color_token`
- **`categories`**: `id`, `user_id`, `name`, `category_group`, `monthly_limit`
- **`transactions`**: `id`, `user_id`, `primary_wallet_id`, `source_wallet_id`, `destination_wallet_id`, `category_id`, `type`, `amount`, `payment_method`, `status`, `transaction_date`, `savings_target_id`
- **`fixed_expenses`**: `id`, `user_id`, `name`, `amount`, `recurrence_type`, `recurrence_value`
- **`loans`**: `id`, `user_id`, `name`, `status`, `total_amount`, `paid_amount`, `next_due_date`, `monthly_installment`
- **`savings_targets`**: `id`, `user_id`, `name`, `target_amount`, `current_amount`, `priority`, `deadline`, `status`
- **`income_streams`**: `id`, `user_id`, `name`, `amount`

### Gamification (Journey Engine)
- **`journey_daily_survival`**: `user_id`, `tracking_date`, `status`, `expense_xp_claimed`, `income_xp_claimed`, `zero_spend_xp_claimed`
- **`journey_inventory`**: `id`, `user_id`, `type`, `status`, `activated_at`, `expires_at`
- **`journey_events`**: `id`, `user_id`, `event_type`, `source`, `severity`, `status`, `xp_delta`, `hp_delta`, `shield_delta`
- **`journey_challenges`**: `id`, `user_id`, `template_id`, `status`, `started_at`, `ends_at`, `progress_data`, `rewards_claimed`
- **`journey_regions`**: `id`, `user_id`, `region_id`, `status`, `started_at`, `ends_at`
- **`journey_region_nodes`**: `id`, `user_id`, `node_id`, `region_id`, `status`
- **`journey_notifications`**: `id`, `user_id`, `category`, `severity`, `title`, `message`, `status`
- **`journey_journal`**: `id`, `user_id`, `message`, `severity`, `source_event_id`, `created_at`

### System
- **`system_flags`**: `key`, `value`

# Backend Architecture & Structure

This document serves as a concise context for AI agents regarding the FinJourney backend structure.

## Core Tech Stack
- **Framework**: FastAPI (Python 3)
- **Database**: PostgreSQL (Supabase)
- **Location**: The backend source code lives inside the Next.js frontend directory, specifically in `frontend/app/`. (Wait, no, Next.js UI is also there, the Python backend shares the `frontend/app/` namespace but is executed as a separate FastAPI server from `main.py`).

## File Structure (`frontend/app/`)
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
- **Core Finance**: `wallets` (`endpoints_wallets.py`), `categories.py`, `transactions.py`.
- **Advanced Finance**: `fixed_expenses.py`, `loans.py`, `endpoints_analytics.py`.
- **Daily State**: `daily.py` (zero-spend claims, standby token usage).

### Gamification Engine (`/api/v1/journey/*`)
Routed through `journey/router.py` (mounted directly on `app` in `main.py`, not via `api_router`).
- Manages game state: HP, XP, Shields, Inventory, Regions, and Challenges.
- **Engine Core**: `journey/engine/bus.py` (event bus logic).
- **Services**: `hp_svc.py`, `xp_svc.py`, `inventory_svc.py`, `cron_svc.py`.

## Architectural Guidelines
1. **Ghost Domains**: In `api.py`, uncreated routers are commented out. Importing a missing module will crash FastAPI.
2. **Mounting Router**: Feature routers in `api/v1/` are attached to `api_router`. The `journey` router is attached directly to the root `app`.
3. **Database Client**: Use Supabase client imported from `app.db.supabase.init_supabase`.
4. **Validation**: All incoming/outgoing data must use models defined in `app/schemas/` or `app/journey/schemas/`.

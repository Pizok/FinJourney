# Wallet & Ledger Backend Architecture — FinJourney (FastAPI Integration)

**register:** technical_spec
**target:** `app/api/v1/endpoints/`, `app/services/`, `app/db/queries/`, `app/schemas/`

## 1. System Purpose & MVP Constraints
The Wallet module is implemented directly within the existing FastAPI application structure. It couples transaction creation tightly with downstream game logic services (`progression_service.py` and `budget_service.py`).

### MVP Performance Constraints (Supabase Free Tier)
The architecture is strictly optimized for a Free Tier Supabase environment.
* No realtime subscriptions required.
* No database triggers required.
* No event sourcing or CQRS.
* No materialized views.
* No background workers or message queues.
* No Redis caching.
* All wallet calculations occur synchronously during transaction creation/update/deletion.
* Analytics aggregations are computed on request.

---

## 2. Database Schema

### `wallets` Table
* `id`: UUID, Primary Key
* `user_id`: UUID, Foreign Key
* `name`: String
* `type`: Enum (`cash`, `bank`, `credit`, `savings`, `investment`)
* `balance`: Integer (cents) - **Source of Truth**
* `color_token`: String
* `created_at`: Timestamp
* `deleted_at`: Timestamp (Nullable)
* **Constraint:** `UNIQUE(user_id, name)`

### `categories` Table
* `id`: UUID, Primary Key
* `user_id`: UUID, Foreign Key
* `name`: String
* `monthly_limit`: Integer (cents)
* `created_at`: Timestamp
* `deleted_at`: Timestamp (Nullable)
* **Constraint:** `UNIQUE(user_id, name)`

### `transactions` Table
* `id`: UUID, Primary Key
* `user_id`: UUID, Foreign Key
* `wallet_id`: UUID, Foreign Key (Nullable)
* `source_wallet_id`: UUID, Foreign Key (Nullable)
* `destination_wallet_id`: UUID, Foreign Key (Nullable)
* `transfer_group_id`: UUID (Nullable) - Links both sides of a transfer operation.
* `category_id`: UUID, Foreign Key (Nullable)
* `type`: Enum (`income`, `expense`, `transfer`)
* `amount`: Integer (cents)
* `status`: Enum (`active`, `deleted`) Default: `active`
* `payment_method`: Enum (`cash`, `debit_card`, `credit_card`, `e_wallet`, `other`)
* `transaction_date`: Date
* `note`: String (Nullable)
* `created_at`: Timestamp
* `deleted_at`: Timestamp (Nullable)

---

## 3. Transaction Validation & Rules

### Transaction Field Rules
* **Income:** `wallet_id` (Required), `category_id` (Required), `source_wallet_id` (Null), `destination_wallet_id` (Null).
* **Expense:** `wallet_id` (Required), `category_id` (Required), `source_wallet_id` (Null), `destination_wallet_id` (Null).
* **Transfer:** `wallet_id` (Null), `category_id` (Null), `source_wallet_id` (Required), `destination_wallet_id` (Required). `source_wallet_id` must not equal `destination_wallet_id`.

### Amount Validation
* Must be > 0.
* Stored and processed exclusively as integer cents.

---

## 4. Security & Ownership

### Ownership Validation
Before any create, update, or delete operation, the service layer must validate:
* `wallet.user_id` must equal `auth.uid()`
* `category.user_id` must equal `auth.uid()`
* `transaction.user_id` must equal `auth.uid()`
* Cross-user references must be rejected with HTTP 403.

---

## 5. API Contracts & Payloads

### Wallet Summary Payload (`GET /api/v1/wallets/summary`)

    {
      "total_balance": 2500000,
      "wallet_count": 3,
      "category_count": 8,
      "active_wallet_id": null,
      "wallets": [],
      "category_usage": [],
      "level_restrictions": {
        "max_wallets": 3,
        "max_categories": 10,
        "can_create_wallet": true,
        "can_create_category": true
      }
    }

### Category Usage Contract

    {
      "category_id": "uuid-string",
      "name": "Food",
      "spent": 450000,
      "limit": 1000000,
      "remaining": 550000,
      "percentage": 45,
      "is_overspent": false
    }

### Pagination Response Contract (`GET /api/v1/transactions`)

    {
      "items": [],
      "page": 1,
      "limit": 20,
      "total": 156,
      "total_pages": 8
    }

---

## 6. Financial Rules & Pipeline

### Balance Update Rules
`wallet.balance` is the absolute source of truth and updates synchronously.
* **Income:** `wallet.balance += amount`
* **Expense:** `wallet.balance -= amount`
* **Transfer:** `source_wallet.balance -= amount` AND `destination_wallet.balance += amount`
* **Soft Delete:** Reverse the original balance effect before marking the transaction as deleted.

### Category Spending Calculation
Current Month Spending is strictly calculated as:
* `SUM(expense.amount)`
* WHERE `status = active` AND `deleted_at IS NULL` AND `transaction_date` is within the current calendar month.

### Transaction Edit Policy
* Transactions may be edited directly via `PATCH /transactions/:id`.
* The backend recalculates affected wallet balances and category spending immediately.
* Historical locking and adjustment events are not implemented in the MVP phase.

### Game Logic Hand-Off
* Upon successful `POST /transactions` (if type is `expense`), the pipeline must hand off to `budget_service.py` to calculate overspending and `apply_daily_bleed`, followed by `progression_service.py`.

---

## 7. Analytics Authority
The backend is the sole authority for financial metrics. The frontend must never independently calculate financial formulas and only visualizes returned values. The backend computes:
* Cashflow summaries
* Category spending totals
* Top transactions
* DTI ratio
* Survival runway
* Asset allocation
* Financial Stability Score

---

## 8. Required New Modules

### `app/schemas/`
* `wallet.py`
* `category.py`
* `wallet_summary.py`

### `app/db/queries/`
* `wallet_queries.py`
* `category_queries.py`

### `app/services/`
* `wallet_service.py`

### `app/api/v1/endpoints/`
* `wallets.py`
* `categories.py`
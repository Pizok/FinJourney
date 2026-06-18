# Backend Implementation File Map — FinJourney Wallet

**register:** implementation_guide
**target:** FastAPI Monolith

To implement the Wallet and Ledger system, the following files must be created or updated within the existing FastAPI directory structure. 

## 1. Pydantic Schemas (`app/schemas/`)
These files handle all incoming request validation (Zod equivalent) and outgoing response formatting. All monetary values must be typed as integers (cents).

* **`wallet.py`**
    * `WalletCreate`: Validation for creating a wallet (requires name, type, starting balance).
    * `WalletUpdate`: Validation for updating a wallet.
    * `WalletOut`: Standard response schema for a wallet object.
* **`category.py`**
    * `CategoryCreate`: Validation for creating a category.
    * `CategoryUpdate`: Validation for updating a category limit.
    * `CategoryOut`: Standard response schema for a category object.
* **`wallet_summary.py`**
    * `CategoryUsage`: The specific schema defining `spent`, `limit`, `remaining`, and `percentage`.
    * `WalletSummaryResponse`: The strict aggregate payload for `GET /api/v1/wallets/summary`.
* *(Note: The `transaction.py` schema already exists but must be updated to support the new `source_wallet_id` and `destination_wallet_id` rules for transfers).*

## 2. Database Queries (`app/db/queries/`)
These files isolate all interactions with the Supabase PostgreSQL database using the Supabase Python client.

* **`wallet_queries.py`**
    * `insert_wallet`, `get_wallets_by_user`, `update_wallet`, `soft_delete_wallet`.
    * `get_wallet_summary`: A specialized query to aggregate total balances and count active wallets.
* **`category_queries.py`**
    * `insert_category`, `get_categories_by_user`, `update_category`, `soft_delete_category`.
    * `get_category_usage`: A specialized query to sum up active expenses for the current month against category limits.

## 3. Business Logic Services (`app/services/`)
This is the core engine where validation, database calls, and game logic intersect.

* **`wallet_service.py`**
    * `create_wallet`: Enforces the Level 1 limits (max 3 wallets) before calling the query layer.
    * `delete_wallet`: Enforces the protection rule preventing the deletion of the last active wallet.
    * `get_wallet_summary_payload`: Aggregates the data from `wallet_queries` and `category_queries` to construct the exact JSON payload expected by the frontend.
* *(Note: The existing `transaction_service.py` must be updated to route successful expense creations to `budget_service.py` and enforce the new idempotency and balance update rules).*

## 4. FastAPI Endpoints (`app/api/v1/endpoints/`)
These files expose the REST API to the Next.js frontend. They must enforce JWT authentication (`get_current_user`).

* **`wallets.py`**
    * `GET /wallets/summary`: Calls `wallet_service.get_wallet_summary_payload`.
    * `GET /wallets`: Lists all active wallets.
    * `POST /wallets`: Creates a new wallet.
    * `PATCH /wallets/{id}`: Updates wallet details.
    * `DELETE /wallets/{id}`: Soft-deletes a wallet.
* **`categories.py`**
    * `GET /categories`: Lists all active categories.
    * `POST /categories`: Creates a new category.
    * `PATCH /categories/{id}`: Updates a category.
    * `DELETE /categories/{id}`: Soft-deletes a category.

## 5. Routing Updates
* **`app/api/v1/api.py`** (or your main router file)
    * Import and include the new `wallets` and `categories` routers so they are exposed to the FastAPI application.
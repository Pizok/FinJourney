# Wallet Data Contract — FinJourney

## Backend Authority

Backend is authoritative for:

* balances
* XP
* HP
* penalties
* historical snapshots
* adjustment events

Frontend only:

* displays formatted values
* manages optimistic UI state

---

# Bootstrap Endpoint

Primary page hydration:

```txt
GET /api/v1/wallet/bootstrap
```

Returns:

```ts
{
  wallets,
  category_limits,
  recent_transactions,
  pagination,
  active_filters,
  feature_unlocks
}
```

---

# Wallet Schema

```ts
{
  id: string
  name: string
  description?: string

  type:
    | "cash"
    | "bank"
    | "credit"

  balance: number

  color_token: string

  default_payment_method:
    | "cash"
    | "debit_card"
    | "credit_card"
    | "transfer"

  visible_category_ids: string[]

  created_at: string
}
```

---

# Category Schema

```ts
{
  id: string

  name: string

  monthly_limit: number

  spent_amount: number

  remaining_amount: number

  progress_percentage: number
}
```

---

# Transaction Schema

```ts
{
  id: string

  type:
    | "income"
    | "expense"
    | "transfer"

  amount: number

  wallet_id: string
  wallet_name: string

  category_id?: string
  category_name?: string

  payment_method:
    | "cash"
    | "debit_card"
    | "credit_card"
    | "transfer"

  note?: string

  created_at: string
  updated_at?: string

  is_adjustment_event: boolean
}
```

---

# Pagination Schema

```ts
{
  page: number
  limit: number
  total_items: number
  total_pages: number
}
```

---

# Filter Schema

```ts
{
  wallet_id?: string

  transaction_type?: string

  category_id?: string

  payment_method?: string

  start_date?: string
  end_date?: string

  min_amount?: number
  max_amount?: number

  search?: string

  sort?:
    | "newest"
    | "oldest"
    | "amount_asc"
    | "amount_desc"
}
```

---

# Add Transaction Payload

```ts
POST /api/v1/transactions
```

```ts
{
  type: string
  amount: number

  wallet_id: string

  category_id?: string

  payment_method: string

  note?: string

  transaction_date: string
}
```

---

# Edit Transaction Payload

```ts
PATCH /api/v1/transactions/:id
```

Only editable:

* amount
* category
* note
* payment method

Editing historical transactions:

* creates adjustment event
* does not rewrite snapshots

---

# Soft Delete Behavior

Deleting transaction:

* never removes DB row
* creates adjustment event
* preserves historical integrity

---

# Wallet Creation Payload

```ts
POST /api/v1/wallets
```

```ts
{
  name: string

  starting_balance: number

  color_token?: string

  description?: string
}
```

---

# Wallet Settings Payload

```ts
PATCH /api/v1/wallets/:id
```

```ts
{
  name?: string

  description?: string

  color_token?: string

  default_payment_method?: string

  visible_category_ids?: string[]
}
```

---

# Error Response Format

```ts
{
  code: string
  message: string
  field?: string
}
```

---

# Important Rules

## Future Dates

Blocked server-side and client-side.

---

## Negative Balances

Allowed after warning confirmation.

---

## Transfer Rules

Transfers:

* do not grant XP
* do not trigger HP penalties
* only move liquidity

---

# Performance Rules

Required:

* paginated transaction queries
* lightweight filter invalidation
* targeted cache refreshes

Avoid:

* fetching entire transaction history
* full-page invalidation

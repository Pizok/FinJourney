# Analytics Data Contract — FinJourney

## Bootstrap Endpoint

```txt
GET /api/v1/analytics/bootstrap
```

Returns:

```ts
{
  unlock_status,
  advisory,
  financial_stability,
  cashflow,
  income_allocation,
  category_breakdown,
  debt_health,
  asset_health,
  top_transactions
}
```

---

# Unlock Status

```ts
{
  unlocked: boolean

  current_level: number

  required_level: 3

  xp_remaining: number
}
```

---

# Financial Stability

```ts
{
  score: number

  score_trend: number

  explanation: string
}
```

Notes:

* Backend calculates score.
* Frontend never calculates score.

---

# Advisory Schema

```ts
{
  priority:
    | "debt_risk"
    | "payment_risk"
    | "overspending"
    | "savings_failure"
    | "optimization"

  headline: string

  recommendation: string

  reduction_targets: {
    category_name: string
    amount: number
  }[]
}
```

---

# Cashflow Schema

```ts
{
  trend_percentage: number

  comparison_period: string

  series: {
    date: string
    income: number
    expense: number
  }[]
}
```

Transfers excluded.

---

# Income Allocation

```ts
{
  total_income: number

  baseline_costs: number

  variable_spending: number

  remaining_amount: number
}
```

Baseline costs originate from:

* Baseline Page
* NOT transaction history

---

# Category Breakdown

```ts
{
  category_id: string

  category_name: string

  amount: number

  percentage: number

  overspending: boolean
}
```

Overspending:

```txt
amount > category_limit
```

---

# Top Transactions

```ts
{
  id: string

  amount: number

  category_name: string

  wallet_name: string

  transaction_date: string
}
```

Sorted:

* highest expense amount
* selected timeframe only

---

# Debt Health

```ts
{
  dti_percentage: number

  status:
    | "good"
    | "warning"
    | "bad"

  active_loans: number

  debt_free_date: string | null

  safe_loan_limit: number
}
```

If unavailable:

```txt
Unable to estimate
```

---

# Asset Health

```ts
{
  liquid_cash: number

  invested_assets: number

  survival_runway_months: number

  savings_target_progress: number
}
```

If no investments:

```ts
{
  invested_assets: 0
}
```

---

# Loan Simulation

```txt
POST /api/v1/analytics/simulate-loan
```

```ts
{
  monthly_installment: number
}
```

Returns:

```ts
{
  projected_dti: number

  projected_status:
    | "good"
    | "warning"
    | "bad"
}
```

---

# Savings Target

Current Scope:

```txt
One Active Savings Target
```

```ts
{
  name: string

  amount: number

  deadline: string
}
```

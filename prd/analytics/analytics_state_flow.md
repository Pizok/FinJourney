# Analytics State Flow — FinJourney

## Route Entry

```txt
Navigate to Analytics
        ↓
Fetch Unlock Status
        ↓
Unlocked?
```

---

## Locked State

```txt
Level < 3
```

Display:

* Analytics Preview
* Unlock Overlay
* XP Remaining Indicator

Disable:

* Charts
* Simulators
* Budget Rebalancing
* Savings Tools

No data mutations allowed.

---

## Unlocked State

```txt
Fetch Analytics Bootstrap
        ↓
Render Skeletons
        ↓
Hydrate Sections
        ↓
Enable Interactions
```

---

# Time Range Flow

```txt
Select Range
       ↓
Update Store
       ↓
Fetch Cached Data
       ↓
Update Affected Sections
```

Rules:

* No page refresh
* Preserve scroll position
* Preserve previous chart until replacement data arrives

---

# Advisory Flow

```txt
Receive Analytics Data
       ↓
Determine Priority
       ↓
Display Single Advisory
```

Priority Order:

1. Debt Risk
2. Payment Risk
3. Overspending
4. Savings Failure
5. Optimization

Only one primary advisory may exist.

---

# Rebalance Budget Flow

```txt
Open Modal
      ↓
Choose Strategy
      ↓
Validate Zero-Sum Rule
      ↓
Submit
      ↓
Update Category Limits
      ↓
Refresh Advisory
      ↓
Recalculate Daily Safe Spending
      ↓
Show Success Toast
```

Validation:

```txt
Total Reductions
=
Overspent Amount
```

Required before submission.

---

# Loan Simulator Flow

```txt
Open Simulator
       ↓
Input Monthly Installment
       ↓
Calculate Projection
       ↓
Display DTI Result
```

Rules:

* No real data mutation
* Advisory only

---

# Savings Target Flow

```txt
Open Target Modal
       ↓
Create / Edit Target
       ↓
Refresh Asset Section
```

Current Scope:

* One active target

---

# Wallet Navigation Flow

```txt
User Clicks Top Transaction
        ↓
Redirect to Wallet
        ↓
Scroll Transaction Into View
        ↓
Apply Temporary Highlight
```

Highlight duration:

* 3–5 seconds

---

# Missing Data Flow

## No Chart Data

Display:

```txt
Not enough data for this timeframe
```

Never fabricate historical trends.

---

## Missing Financial Inputs

Display contextual guidance.

Never:

* invent values
* estimate missing data
* display misleading zeroes

---

## Asset Allocation Fallback

```txt
Invested = 0
```

Display:

```txt
No investment assets recorded.
```

---

## Debt-Free Date

Insufficient data:

```txt
Unable to estimate
```

---

# Mobile Flow

Desktop:

* Bento Layout

Mobile:

* Single Column Stack

Charts:

* Responsive Width
* Abbreviated Labels

Buttons:

* Full Width

Cards:

* Maintain reading order

---

# Mutation Refresh Rules

Transaction Added:

* Refresh cashflow
* Refresh allocation
* Refresh advisory

Transaction Edited:

* Refresh affected sections only

Transaction Deleted:

* Refresh affected sections only

Budget Rebalanced:

* Refresh advisory
* Refresh allocation
* Refresh category breakdown

Avoid:

* full analytics reload
* complete page re-render

---

# Error Handling

Fetch Error:

* Retry CTA
* Preserve Previous Data

Mutation Error:

* Rollback optimistic UI
* Preserve Context
* Display Error Feedback

Analytics should feel:

* trustworthy
* actionable
* lightweight

Never speculative.

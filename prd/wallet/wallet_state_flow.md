# Wallet State Flow — FinJourney

## Existing Application Flow

Completed:

1. Landing
2. Authentication
3. Onboarding
4. Dashboard

Current phase:
5. Wallet Page

Wallet is a detailed operational finance view.

---

# Page Initialization Flow

```txt
Navigate to Wallet
    ↓
Bootstrap Request
    ↓
Render Skeleton UI
    ↓
Hydrate Wallet Overview
    ↓
Hydrate Categories
    ↓
Hydrate Transactions
    ↓
Enable Filters & Interactions
```

---

# Empty State Hierarchy

## No Wallets

Highest priority empty state.

Display:

* wallet creation CTA
* onboarding guidance

Disable:

* transaction creation
* category tracking

---

## No Transactions

Display:

* first transaction guidance
* add transaction CTA

Wallet overview still visible.

---

# Wallet Selection Flow

## Default State

Display:

* all wallets
* all transactions
* all category progress

---

## Wallet Selected

Effects:

* highlight selected wallet
* filter transactions
* filter category tracking

---

## Wallet Reselection

Clicking selected wallet again:

* clears filter
* returns global view

---

# Transaction Flow

```txt
Click Add Transaction
    ↓
Open Shared Transaction Modal
    ↓
Validate Fields
    ↓
Submit Request
    ↓
Optimistic UI Update
    ↓
Server Confirmation
    ↓
Refresh Related Wallet State
```

---

# Transaction Failure Recovery

Required:

* preserve form values
* show inline validation
* allow retry

Avoid:

* silent modal close
* clearing user input

---

# Edit Transaction Flow

```txt
Click Edit
    ↓
Open Prefilled Modal
    ↓
Submit Changes
    ↓
Create Adjustment Event
    ↓
Refresh Affected UI
```

---

# Delete Transaction Flow

```txt
Click Delete
    ↓
Open Confirmation Modal
    ↓
Confirm Action
    ↓
Execute Soft Delete
    ↓
Create Adjustment Event
    ↓
Refresh Transaction List
```

---

# Negative Balance Flow

```txt
Transaction Causes Negative Balance
    ↓
Show Warning Modal
    ↓
User Cancels
    OR
User Proceeds
```

Negative balances are allowed after acknowledgment.

---

# Wallet Creation Flow

```txt
Click Add Wallet
    ↓
Open Wallet Creation Modal
    ↓
Validate Inputs
    ↓
Submit
    ↓
Refresh Wallet Overview
```

---

# Wallet Deletion Flow

## Normal Wallet

```txt
Delete Wallet
    ↓
Type Wallet Name
    ↓
Confirm
    ↓
Delete
```

---

## Last Wallet Protection

If only one wallet exists:

* delete action disabled
* tooltip explains restriction

---

# Filter State Flow

## Filters

Supported:

* wallet
* category
* transaction type
* payment method
* date range
* amount range
* note search

---

# Filter Behavior

Required:

* lightweight updates
* preserve pagination state where possible
* avoid full-page refresh

---

# Pagination Flow

```txt
Change Page
    ↓
Fetch Next Transaction Batch
    ↓
Update Transaction List
```

Avoid:

* full-page loading states

---

# Loading Rules

Required:

* section-based skeletons
* independent hydration
* lightweight transitions

Avoid:

* blocking spinners
* layout jumping

---

# Mobile State Flow

## Mobile Wallet Navigation

Wallet cards:

* horizontal scroll

Filters:

* bottom drawer/sheet

Transactions:

* stacked cards

Primary CTA:

* sticky bottom button

---

# Error States

## Fetch Failure

Display:

* lightweight retry UI
* preserve previous successful state when possible

---

## Mutation Failure

Required:

* rollback optimistic updates
* preserve user context
* show actionable error message

---

# Accessibility Flow

Required:

* keyboard navigable tables
* modal focus trapping
* ESC close support
* screen reader labels
* reduced motion support

Accessibility should remain functional across:

* tables
* drawers
* filters
* modals

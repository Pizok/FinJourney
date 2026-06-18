# Settings State Flow — FinJourney

## Primary Page Lifecycle

```txt
Page Load
    │
    ▼
Fetch Settings Payload
    │
    ├── Loading
    │      ▼
    │   SettingsSkeleton
    │
    ├── Error
    │      ▼
    │   SettingsErrorState
    │
    └── Success
           ▼
      Settings Loaded
```

---

## Settings Editing Flow

```txt
Loaded State
    │
User Modifies Input
    │
    ▼
Dirty State
    │
Show Unsaved Changes Bar
    │
    ├── Save Changes
    │       ▼
    │   PATCH Request
    │       ▼
    │   Success Toast
    │       ▼
    │   Clean State
    │
    └── Discard
            ▼
       Restore Previous Values
```

---

## Financial Validation Flow

```txt
Income Changed
Savings Changed
    │
    ▼
Realtime Validation
    │
    ├── Valid
    │      ▼
    │   Save Enabled
    │
    └── Invalid
           ▼
      Error Message
           ▼
      Save Disabled
```

Validation:

```txt
Savings Allocation
<=

Expected Income
-

Fixed Costs
```

---

## Path Change Flow

```txt
Change Path Button
    │
    ▼
Cooldown Check
    │
    ├── Cooldown Active
    │       ▼
    │   Button Disabled
    │
    └── Cooldown Expired
            ▼
      Open ChangePathModal
            ▼
      Select Path
            ▼
      Confirm
            ▼
      POST Path Change
            ▼
      Success Toast
            ▼
      Start 6 Month Cooldown
```

---

## Reset Progress Flow

```txt
Danger Zone
    │
    ▼
Reset Progress Button
    │
    ▼
Reset Modal
    │
Type RESET
    │
    ▼
Enable Confirm Button
    │
    ▼
POST Reset
    │
    ▼
Journey Reset
    │
    ▼
Refresh Bootstrap State
```

---

## Timezone Protection Flow

```txt
Timezone Changed
    │
    ▼
Backend Validation
    │
    ├── Allowed
    │       ▼
    │   Save
    │
    └── Locked
            ▼
      Revert Selection
            ▼
      Error Toast
```

---

## Privacy Mode Flow

```txt
Privacy Mode ON
    │
    ▼
Hide Financial Values
    │
    ├── Dashboard
    ├── Wallet
    ├── Analytics
    └── Journey
```

Display Format:

```txt
Rp ***.***
```

---

## Fixed Cost Breakdown Flow

```txt
View Breakdown
    │
    ▼
Open Breakdown Modal
    │
    ▼
Display Loans
Display Fixed Categories
Display Total
    │
    ▼
Close
```

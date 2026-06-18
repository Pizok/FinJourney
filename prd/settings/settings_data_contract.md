# Settings Data Contract — FinJourney

## Primary Hydration

### GET /api/v1/settings

```json
{
  "profile": {
    "avatar_url": "/avatars/default.png",
    "username": "Pi",
    "email": "user@email.com",
    "timezone": "Asia/Jakarta",
    "timezone_locked_until": null,
    "primary_payday": 25
  },
  "financials": {
    "expected_monthly_income": 10000000,
    "monthly_savings_target": 2000000,
    "fixed_costs": {
      "total": 4360000,
      "active_loans": 2,
      "fixed_categories": 4
    },
    "projected_safe_daily_budget": 120000
  },
  "progression": {
    "active_path": {
      "id": "sentinel",
      "name": "Sentinel",
      "description": "Defensive focus."
    },
    "cooldown_active": true,
    "cooldown_days_remaining": 124
  },
  "preferences": {
    "theme": "system",
    "reduced_motion": false,
    "privacy_mode": false
  },
  "notifications": {
    "daily_reminder": true,
    "hazard_alerts": true,
    "achievement_notifications": true
  }
}
```

---

## Update Profile

### PATCH /api/v1/settings/profile

Request

```json
{
  "username": "Pi",
  "timezone": "Asia/Jakarta",
  "primary_payday": 25
}
```

Response

```json
{
  "success": true,
  "message": "Profile updated."
}
```

---

## Update Financial Baselines

### PATCH /api/v1/settings/financials

Request

```json
{
  "expected_monthly_income": 10000000,
  "monthly_savings_target": 2000000
}
```

Response

```json
{
  "success": true,
  "projected_safe_daily_budget": 120000
}
```

---

## Update Preferences

### PATCH /api/v1/settings/preferences

Request

```json
{
  "theme": "dark",
  "reduced_motion": true,
  "privacy_mode": false
}
```

Response

```json
{
  "success": true
}
```

---

## Update Notification Settings

### PATCH /api/v1/settings/notifications

Request

```json
{
  "daily_reminder": true,
  "hazard_alerts": true,
  "achievement_notifications": false
}
```

Response

```json
{
  "success": true
}
```

---

## Path Change

### POST /api/v1/settings/path/change

Request

```json
{
  "path_id": "phantom"
}
```

Response

```json
{
  "success": true,
  "cooldown_days": 180,
  "active_path": {
    "id": "phantom",
    "name": "Phantom"
  }
}
```

---

## Reset Journey Progress

### POST /api/v1/settings/reset-progress

Request

```json
{
  "confirmation": "RESET"
}
```

Response

```json
{
  "success": true,
  "level": 1,
  "xp": 0,
  "hp": 100
}
```

---

## Fixed Cost Breakdown

### GET /api/v1/settings/fixed-costs

Lazy-loaded when opening the breakdown modal.

```json
{
  "loans": [
    {
      "name": "Car Loan",
      "amount": 1500000
    }
  ],
  "fixed_categories": [
    {
      "name": "Rent",
      "amount": 1500000
    }
  ],
  "total": 4360000
}
```

---

## Query Keys

```txt
['settings']

['settings','profile']

['settings','financials']

['settings','preferences']

['settings','notifications']

['settings','fixed-costs']
```

---

## Cache Invalidation

Invalidate:

```txt
['settings']
```

after:

* Profile Update
* Financial Baseline Update
* Path Change
* Notification Update
* Preference Update
* Progress Reset

No polling.

staleTime: 300 seconds
refetchOnWindowFocus: true

```
```

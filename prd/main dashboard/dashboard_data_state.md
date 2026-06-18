# Dashboard Data & State Flow — FinJourney

## Important Rule: Backend Authority
The backend is the sole source of truth. The frontend must never calculate:
* XP
* HP
* Level
* Penalties
* Rewards

---

## Data Contract

**Bootstrap Endpoint:**
Primary data load endpoint: `GET /api/v1/me/bootstrap`

**Returns:**
```json
{
  "profile": {
    "username": "string",
    "avatar_class": "Sentinel | Catalyst | Phantom",
    "level": "number",
    "hp": "number",
    "xp": "number",
    "gold": "number",
    "shield": "number",
    "active_theme": "string"
  },
  "daily_status": {
    "daily_budget": "number",
    "spent_today": "number",
    "remaining_budget": "number",
    "streak_count": "number",
    "zero_spend_marked": "boolean"
  },
  "tasks": [
    {
      "id": "string",
      "title": "string",
      "completed": "boolean",
      "reward_xp": "number"
    }
  ],
  "transactions": [
    {
      "id": "string",
      "type": "income | expense | transfer",
      "amount": "number",
      "category_name": "string",
      "wallet_name": "string",
      "created_at": "string"
    }
  ],
  "wallets": [],
  "categories": [],
  "active_region": {},
  "feature_unlocks": {}
}
```

**Transaction Rules:**
* The frontend may use optimistic updates to insert a UI row instantly.
* The backend remains the source of truth and recalculates the budget.
* Future dates are strictly prohibited.

---

## Application States & Flow

**Dashboard Initialization Flow:**
1. Login Success
2. Bootstrap Request
3. Dashboard Skeleton UI
4. Load Cards Independently
5. Evaluate Modal Priority
6. Render Highest Priority Modal

**Modal Priority (Only one blocking modal at a time):**
1. Critical Failure
2. Review Result
3. Hazard Warning
4. Welcome
5. Tutorial
6. Generic Notifications

**Empty State Conditions (Never show blank UI):**
* **Incomplete Baseline:** Disable the budget calculation UI and prompt the user to configure their income and fixed costs.
* **No Transactions:** Show first-transaction onboarding guidance.
* **No Challenge:** Display the idle narrative/exploration state.

**Penalty States:**
* **Critical Failure:** Triggered when HP = 0. UI becomes grayscale/desaturated. Progression is disabled and a warning state persists.
* **Low HP State:** Triggered when HP is below 30%. Applies danger emphasis (Terracotta HP bar).
* **Standby Mode:** Shows active protection and displays the remaining 24h duration.

**Error Recovery:**
* Preserve form input values on failure.
* Support manual retry.
* Avoid full-page reloads.
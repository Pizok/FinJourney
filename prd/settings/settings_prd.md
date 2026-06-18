# Settings Page Design Specification (Final)

**register:** design_spec
**target:** Next.js Frontend / Tailwind CSS
**domain:** Global Assumptions & User Preferences

## 1. Layout Architecture & State Management

* **Desktop:** Sidebar navigation (Profile, Financials, Progression, Preferences) on the left, with a single, scrollable content column on the right.
* **Mobile:** Single scrollable view.
* **Containers:** Flat `Canvas Surface` cards with a 1px `Tactical Border`. Generous `p-6` or `p-8` padding.

### State Management & Saving
* **Dirty State (Unsaved Changes):** If a user alters any input, toggle, or dropdown, a sticky banner appears at the bottom of the screen or top of the card.
    * *Content:* "You have unsaved changes."
    * *Actions:* `[Discard]` and `[Save Changes]`
    * *Behavior:* Prevents accidental navigation loss. Disappears upon successful save.
* **Global Success State:** Upon clicking `[Save Changes]`, a non-blocking toast appears in the bottom-right corner (e.g., `✓ Settings Updated`).

---

## 2. Configuration Modules (The Cards)

### Card 1: Profile & Account
Manages foundational identity and system defaults.
* **Avatar & Username:** Editable. Updates the Player ID card on the dashboard.
* **Connected Email:** Read-only (managed via auth provider).
* **Timezone Selector:** Dropdown. Critical for the midnight game-state reset and QStash notification triggers.
* **Primary Payday:** Dropdown (1st–31st). 
    * *Helper Text:* "Used for monthly planning and budget projections."

### Card 2: Financial Assumptions
Manages the planning assumptions used to calculate the Journey Dashboard's hero metric. Immediate visual feedback is provided here.
* **Expected Monthly Income:** Editable Input (e.g., `Rp 10.000.000`).
* **Monthly Savings Allocation:** Editable Input (e.g., `Rp 2.000.000`).
* **Fixed Costs (Calculated):** Read-Only Display (e.g., `Rp 4.360.000`).
    * *Details List:* • 2 Active Loans • 4 Fixed Categories
    * *Action:* `[View Breakdown]` (Triggers the Breakdown Modal).
* **Projected Safe Daily Budget:** Read-Only Display (e.g., `Rp 120.000 / day`). Updates instantly as Income or Savings inputs change.
* **Primary Action:** `[Open Wallet Manager]` (Secondary ghost button navigating to the Wallet domain to edit loans/categories).

### Card 3: Journey & Progression
Manages the gamified layer parameters.
* **Active Path:** Displays the current philosophy (e.g., *Sentinel*).
* **Passive Bonus Display:** Explicitly lists the current benefits (e.g., *Passive Bonus: + Shield effectiveness, + Emergency fund rewards*).
* **Cooldown Display:** Explicit text below the path if a cooldown is active (e.g., *Next Path Change: 124 Days Remaining*).
* **Change Path Button:** Triggers the Path Selection modal. Disabled if the cooldown is active.
* **Danger Zone:** `[Reset Game Progress]` button utilizing the `--terracotta` danger color.

### Card 4: Preferences & Experience
Manages app behavior and local UI rendering.
* **Theme:** Radio toggle (Light / Dark / System).
* **Reduced Motion:** Toggle to disable animations and transitions.
* **Privacy Mode:** Toggle to hide financial values behind asterisks in public settings.
    * *Scope Definition:* When enabled, values on the **Dashboard**, **Wallet**, and **Analytics** pages render as `Rp ***.***`. Values within the **Settings** inputs remain visible to allow for editing.

### Card 5: Notifications & Alerts
Manages triggers for external and in-app alerts.
* **Daily Reminder:** Toggle for the evening transaction reminder.
* **Hazard Alerts:** Toggle for immediate alerts when a Debt Ambush occurs or HP drops to critical levels.
* **Achievement Notifications:** Toggle for positive game events (e.g., Level Ups, Quarter Completions).

---

## 3. Modals & Deep Interactions

### Fixed Costs Breakdown (Modal)
Triggered by clicking `[View Breakdown]` in the Financial Assumptions card. Read-only transparency view; no editing allowed.
* **Header:** Fixed Costs Breakdown
* **Loans Section:** Lists active loans and monthly amounts (e.g., *Car Loan ........ Rp 1.500.000*).
* **Categories Section:** Lists fixed budget categories and amounts (e.g., *Rent ............ Rp 1.500.000*).
* **Total Footer:** Sum of all fixed costs (e.g., *Total ........... Rp 4.360.000*).

### Change Player Path (Modal)
* **Header:** Select Your Path
* **Content:** Description of the three paths and their specific bonuses.
* **Warning Banner:** "Changing your path initiates a 6-month cooldown. You cannot change it again during this period."
* **Action Button:** `[Confirm Path Change]`

### Reset Game Progress (Modal)
* **Header:** Reset Journey Progress? (Using `--terracotta` text)
* **Content:** "This will reset your Level to 1, XP to 0, and HP to 100. Your region progress will restart. **Your financial data, wallets, and transaction history will not be deleted.**"
* **Verification:** User must type "RESET" into a text input to enable the confirm button.
* **Action Button:** `[Confirm Reset]` (Solid red button).

---

## 4. Guardrails & Misbehavior Prevention

### 1. Path Cooldown Lock
* **Rule:** Path changes are hard-locked for 6 months after selection.
* **UI Enforcement:** The `[Change Path]` button is visually disabled. The exact remaining duration is printed directly above the button.

### 2. Timezone Hopping Protection
* **Rule:** Timezone changes are restricted to prevent players from shifting midnight to avoid Ghost Penalties or extend challenge deadlines.
* **UI Enforcement:** Limited to once every 30 days. Attempting to change it again reverts the dropdown and shows an error toast: "Timezone can only be changed once every 30 days."

### 3. Impossible Budget Validation
* **Rule:** A user cannot set a "Monthly Savings Allocation" that mathematically breaks the game by pushing the daily budget into the negative.
* **UI Enforcement:** Real-time form validation. If Savings > (Income - Fixed Costs), the input is outlined in `--terracotta`, the `[Save Changes]` button is disabled, and the exact math is displayed below the input:
    * *Error State UI:* "Invalid Target. Available after fixed costs: Rp 5.640.000. Your savings target: Rp 6.000.000."
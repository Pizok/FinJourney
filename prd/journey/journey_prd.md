# Journey Dashboard Design Specification (Final)

**Target:** Next.js Frontend / Tailwind CSS / TanStack Query

## 1. Design Tokens & Typography
The UI strictly enforces "The Clear Night Journey" aesthetic, focusing on premium financial utility and avoiding AI-template aesthetics. Colors must be managed exclusively via the Tailwind theme; hardcoded hex values in components are strictly banned.

**Core & State Color Tokens:**
* `--abyssal-slate`: `#0F172A` (Main background)
* `--canvas-surface`: `#1E293B` (Cards / modals)
* `--tactical-border`: `#334155` (Borders / separators)
* `--muted-emerald`: `#0D9488` (Primary accent / HP Bar)
* `--steel-violet`: `#6366F1` (Secondary accent)
* `--dawn-gold`: `#F59E0B` (XP / milestones)
* `--pearl-text`: `#F8FAFC` (Base text)
* `--terracotta`: `#E11D48` (Danger / HP below 30%)

**Typography:**
* **Headers / Large Numbers:** Source Sans 3 (Medium or Semibold weight). Semantic hierarchy is strict; never skip heading levels (e.g., h1 → h2 → h3).
* **Body / Data:** IBM Plex Sans (Regular weight). Constrain line lengths to 70–80 characters (`max-w-prose` or `max-w-2xl`). All-caps body text is banned; use uppercase only for tiny labels or badges.

**Icons:**
* Use `lucide-react` with `strokeWidth={2}`.
* System emojis are strictly prohibited.

**Structural & Polish Tokens:**
* `--radius-card`: `rounded-lg` or `rounded-xl`
* Spacing priorities: `p-6`, `p-8`, `gap-6`, `gap-8`

**Strict Visual Bans:** No glassmorphism, no pure black (`#000000`), no outer glows on cards, no noisy gradients, and no glowing buttons on the dashboard.

**Mobile Behavior (The Region Map):**
On mobile screens, stack layouts to preserve spacing and readability. The Region Map uses a horizontal scroll container with CSS scroll-snapping, ensuring the current region node is always centered and legible without compressing widgets.

---

## 2. Dynamic State Management & Empty States

**Module-Level Empty States**
* **The Region Map (New Account):** "Your journey has not started yet. Log a transaction to begin."
* **Inventory:** "No active items."
* **Notifications:** "No recent events."
* **Journey Journal:** "Your story begins when you log your first transaction."
* **Quarterly Review:** "Your next review is being prepared."

**Analytics Lock State**
If the user is below Level 3, the `analytics_snippets` payload returns a locked state. The frontend renders a blurred placeholder with a padlock icon.
* **UI Copy:** "Analytics Locked. Reach Level 3 to unlock."

**Critical Failure UX Rules**
When HP = 0, the dashboard enters a grayscale Critical Failure state.
* ❌ **Blocked:** XP gain is frozen. Challenge progression is paused. Region progression halts.
* ✅ **Allowed:** Viewing the dashboard. Viewing transactions. Executing the "Financial Audit" recovery action to revive 10 HP.

---

## 3. Game Mechanics: The Player Path System
The chosen financial philosophy dictates UI accents and passive rules.
* **Sentinel:** Focuses on defense. Receives shield bonuses.
* **Catalyst:** Focuses on aggressive growth. Receives XP multipliers on income.
* **Phantom:** Focuses on minimalism. Reduced Ghost Penalties.

*UI Rule:* The path displays next to the Username. It is permanent but can change with a 6-month cooldown.

---

## 4. Core Dashboard Modules (The 3-Row Layout)
The dashboard structure centers on a spacious AAA-style layout with strong breathing room between sections. Containers use a Canvas Surface background and a 1px Tactical Border.

### Row 1: Identity & Macro-Progression (Side-by-Side Cards)
**Left Card: Player Status**
* **Player ID:** Avatar, Username, chosen Path, and current Level.
* **Available Funds:** Scannable summary of total liquid money.
* **Progression Bar:** Shows current XP and points required for the next level. Uses the Dawn Gold color.
* **Next Unlock:** Explicitly states the upcoming feature and required XP.
* **Vitality Bar:** Displays current HP out of 100. Uses Muted Emerald, shifting to Terracotta when HP drops below 30%. Bar container uses an inset Abyssal Slate background.
* **Status Effect Area:** A small row for active buff/debuff icons.

**Right Card: The Region Map (12-Month Journey)**
* **Current Region:** Displays the name of the active region.
* **Timeline Tracker:** A node-based path representing the 365 `account_days` cycle.
* **Next Milestone:** An immediate forward-looking goal.
* **The Region Shift:** The final destination node representing the yearly region shift.
* **Numerical Progress:** Explicitly displays the current timeline position.

### Row 2: Active Encounter (The Quarterly Review)
**Main Card: Active Challenge**
* **Current Status Summary:** An overarching sentence evaluating their current standing.
* **Encounter Type & Countdown:** Displays the current review template alongside an urgency countdown.
* **Priority Objective:** Highlights the single most critical goal.
* **Progress Summary:** A scannable overview with a master progress bar.

### Row 3: The Daily Execution (Inventory & Actions)
**Left Section: Inventory & Events**
* **Standby Tokens:** Displays current token count against maximum capacity.
* **Defense Shields:** Displays active shields alongside explicit expiration data.
* **Latest Event Preview:** A tiny log showing the most recent narrative action.

**Right Section: Dashboard Hero Metric & Actions**
* **Today's Safe Budget (Hero Metric):** The most visually prominent number on the dashboard, positioned centrally above the action buttons.
* **Daily Progress Checklist:** A rapid feedback mechanism right below the budget.
* **Log Transaction:** The primary call-to-action button. Uses a solid or hollow Muted Emerald style with no glow.
* **Zero-Spend Claim & Use Standby Mode:** Secondary ghost buttons utilizing transparent backgrounds and Tactical Borders. Hover states transition to Dawn Gold or Steel Violet without shadows.

---

## 5. Deep-Dive Interaction Layers & Modals
Modals must be centered, spacious, and use a Canvas Surface background with a subtle, non-glowing shadow.

**Level Up & Unlock Celebration (Modal)**
Triggered immediately when XP crosses a feature gate threshold.
* **Visual:** A celebratory modal utilizing Dawn Gold accents.
* **Header:** LEVEL UP: Level 3 Reached
* **Context:** Explicitly highlights the newly available feature.
* **Action Button:** [Explore Analytics] to immediately drive the user to the reward.

**Quarterly Review Drill-Down (Modal)**
Triggered by clicking the Active Challenge card.
* **Header:** Challenge Name and Urgency Countdown.
* **Objectives List:** Granular progress bars for each win condition.
* **Reward Showcase / Failure Consequences:** Explicit lists of passing rewards and missing target penalties.

**Inventory & Expiration Details (Modal)**
Triggered by clicking the Inventory section. Avoids fake complexity by grouping similar items.
* **Standby Tokens:** Shows capacity and mechanical description.
* **Defense Shields:** Simple grouped view (e.g., 2 Active • Next Expiry: 3 Days Remaining).

**Actionable Notification Center (Dropdown/Drawer)**
The bell icon opens a categorized list of recent events.
* **Action Buttons:** Drive the user to the correct recovery or reward screen.

### Hazard & Critical Failure Recovery Flows
**Hazard Overlay (Modal)**
Triggered when a specific penalty occurs.
* **Header:** Warning indicator using Terracotta.
* **Details:** The cause and consequence.
* **Recovery Action:** Clear instructions with actionable buttons.

**Critical Failure (Dashboard Lock Overlay)**
Triggered when HP reaches 0.
* **Visual:** The dashboard remains visible but is dimmed with a grayscale overlay. A central banner states CRITICAL FAILURE.
* **Context:** "Financial Audit Required."
* **Permissions:** The user can still view the dashboard, transactions, and execute the audit. XP gain and challenge progression are completely frozen.
* **Action Button:** [Review & Revive] guides user through the audit flow to restore +10 HP.

### Micro-Interactions & Journaling
**Zero-Spend Success (Toast Notification)**
Triggered upon successfully claiming a Zero-Spend day.
* **Visual:** A non-blocking toast notification in the bottom-right corner.
* **Content:** "✓ Zero-Spend Day Claimed! +10 XP. Ghost Protection Activated."

**Journey Journal (Side Panel/Drawer)**
Triggered by clicking the "Latest Event Preview" on the main dashboard.
* **Format:** A scrollable vertical timeline of the last 30 events.

---

## 6. Transaction Modal UX
Triggered by the primary CTA. Requires conditional rendering based on transaction type.
* **Income:** Amount, Wallet, Category (Required), Note.
* **Expense:** Amount, Wallet, Category (Required), Note.
* **Transfer:** Amount, Source Wallet (Required), Destination Wallet (Required), Note. (Category is hidden. Grants no XP).

---

## 7. API & State Management Architecture

### 7.1 Asset Registry Protocol
The backend must never send absolute file paths. The frontend maintains a local `regionRegistry`. The backend sends `region_id: "quiet_valley"`, and the frontend maps it to the correct local asset.

### 7.2 Primary Hydration: The Bootstrap Payload
The dashboard acts as a summary UI. Upon loading, it fetches a single consolidated payload.
* **Endpoint:** `GET /api/v1/journey/bootstrap`
* **Constraint:** This payload must only contain summary data. It strictly prohibits massive arrays like full transaction histories or historical journal logs.

```json
{
  "player_state": {
    "level": 2,
    "xp": 520,
    "xp_needed": 700,
    "hp": 67,
    "max_hp": 100,
    "critical_failure": false,
    "path": {
      "id": "sentinel",
      "name": "Sentinel",
      "description": "Defensive focus. Emergency fund bonuses."
    }
  },
  "feature_unlocks": {
    "analytics": false,
    "icon_customization": true,
    "unlimited_wallets": false
  },
  "daily_status": {
    "safe_daily_budget": 250000,
    "expenses_logged_today": true,
    "zero_spend_eligible": false,
    "ghost_penalty_protected": true
  },
  "region_progress": {
    "region_id": "quiet_valley",
    "name": "The Quiet Valley",
    "days_progress": 273,
    "days_remaining": 92
  },
  "active_challenge": {
    "status": "active",
    "type": "savings_fortress",
    "title": "Build the Fortress",
    "days_remaining": 12,
    "win_conditions": [
      {
        "label": "Save Rp1.000.000",
        "current": 450000,
        "target": 1000000
      }
    ]
  },
  "inventory": {
    "standby_mode": {
      "active": true,
      "ends_at": "2026-06-02T23:59:59Z",
      "tokens_remaining": 4,
      "max_tokens": 7
    },
    "active_shields": [
      {
        "id": "uuid",
        "expires_at": "2026-06-05T10:00:00Z",
        "strength": 10
      }
    ]
  },
  "recent_logs": {
    "journal_events": [
      {
        "date": "2026-06-01",
        "message": "Stayed under budget",
        "severity": "success",
        "xp_change": 10,
        "hp_change": 0
      }
    ]
  },
  "notifications": {
    "unread_count": 1,
    "items": [
      {
        "id": "uuid",
        "type": "ghost_penalty",
        "severity": "danger",
        "title": "Ghost Penalty Applied",
        "message": "You lost 10 HP due to 3 days of inactivity.",
        "created_at": "2026-06-01T08:00:00Z",
        "read": false
      }
    ]
  },
  "analytics_snippets": {
    "locked": true,
    "required_level": 3
  }
}
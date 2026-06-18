# Dashboard Core Requirements — FinJourney

## Context & Purpose
The Dashboard is the main finance hub. It exists inside `app/(minimal)` and explicitly excludes marketing headers and footers to provide an application-focused experience.

**Primary Goals:**
* Financial awareness
* Fast transaction logging
* Progression visibility
* Hazard visibility
* Easy daily usage

**Avoid:**
* Analytics-heavy layouts
* Excessive RPG clutter
* Noisy gamer UI

**Vibe:** Tactical, calm, premium, readable, and intentional. 

---

## Navigation Bar
Sidebar only. Items display active states, show requirements for locked features, and have a persistent collapse state.

**Items (in order):**
1. Dashboard
2. Wallet
3. Journey
4. Baseline
5. Analytics (Requires Level 3+)
6. Shop
7. Settings

---

## Layout Structure

**Container Rules:**
* Max-width: 1440px
* Centered
* gap-6 or gap-8 spacing
* Desktop-first approach

**Mobile Layout:**
* Rows stack vertically
* Preserve spacious layout
* Primary CTA (Add Transaction) always visible

---

## Row 1 — Progression

**Current Challenge Card**
* **Purpose:** Displays the active review, narrative event, or idle state.
* **Layout:** Side-by-side flex container (text and progress indicators on one side, thematic illustration on the other side)[cite: 1, 7].
* **Displays:** Title, short description, and countdown/progress.
* **Assets:** Illustration must be dynamically loaded from the backend registry to avoid hardcoded frontend imports[cite: 5, 7].

**Profile & Vitals Card**
* **Displays:** Avatar, class, level, HP, XP, shield, gold, daily task progress.
* **Rules:** HP turns to the danger color below 30%. The backend is authoritative; the frontend never calculates progression.

---

## Row 2 — Financial State

**Financial Situation Card**
* **Shows:** Debt hazards, ghost penalty, standby mode, streak, active protection.
* **Rules:** The highest severity state is prioritized and displayed first.

**Daily Budget Card**
* **Displays:** Remaining budget, spent today, safe daily limit.
* **Rules:** Uses a large, readable number. Updates immediately after transactions.

---

## Row 3 — Actions

**Recent Log Card**
* **Displays:** The latest 5 transactions.
* **Includes:** A secondary "View Wallet" button.
* **Empty State:** Shows onboarding guidance for the first transaction.

**Quick Action Card**
* **Purpose:** Fastest transaction entry point.
* **Contains:** Primary "Add Transaction" CTA.
* **Behavior:** Opens the transaction modal.

---

## UI & Visual Rules

**Core Theme:** "The Clear Night Journey"
**Spacing:** Preferred `gap-6`, `gap-8`, `p-6`, `p-8`. Avoid cramped widgets.
**Typography:** 
* *Source Sans 3:* Headings, large budget numbers, progression stats.
* *IBM Plex Sans:* Body text, descriptions, lists, helper text.

**Card Styling:**
* Flat surfaces, `rounded-xl`, subtle borders, spacious padding.
* **Avoid:** Glassmorphism, heavy shadows, glowing borders, noisy gradients.

**Motion & Interaction:**
* **Allowed:** Fade transitions, subtle hover transitions, smooth progress bars.
* **Avoid:** Aggressive animation, particles, flashy motion, glowing buttons.

**Icons:** Use `lucide-react`. Avoid emojis or decorative fantasy icons.
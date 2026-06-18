# Wallet Page Product Requirements — FinJourney

**register:** product
**target:** `app/(minimal)/wallet/page.tsx`

## 1. Page Purpose
The Wallet page is the detailed financial ledger. It allows users to view their liquid balances, track spending limits across global categories, and manage their full transaction history while capturing accurate payment methods for cash flow analytics. 

**Current Scope:** Single currency only. Multi-currency support is not included in this phase.

---

## 2. Data Architecture & Rules

**Global Categories vs. Wallets:**
*   **Wallets:** Act as the source of funds (e.g., Cash, Bank, Credit Card).
*   **Categories:** Are global (e.g., Food, Transport). They are not duplicated per wallet. 
*   **Payment Method:** Defines how the transaction was executed (Cash, Debit Card, Transfer, Credit Card).

**Financial Precision Rules:**
*   All financial calculations (addition, subtraction, percentage limits) must use backend precision. 
*   The frontend only formats the display values to prevent floating-point calculation bugs.

**Transaction Rules:**
*   **Types:** Restricted to `income`, `expense`, and `transfer`.
*   **Transfers:** Moving money between wallets does not trigger Daily Bleed penalties or grant XP.
*   **Soft Deletes:** Deleting a transaction creates a backend adjustment event; it does not hard-delete the database row.
*   **Level 1 Limits:** Users are capped at 3 Wallets and 10 Categories.

---

## 3. Layout & Structure
**Container:** Standard max-width 1440px, centered, with `gap-8` vertical spacing.

**Responsive & Density Rules:**
*   **Mobile:** Wallet cards switch to horizontal scroll. The transaction table converts to stacked cards. Filters collapse into a bottom sheet or drawer. The "Add Transaction" button becomes sticky at the bottom.
*   **Row Density:** Transaction rows must prioritize readability and whitespace. Maintain a minimum row height of 48–56px for a premium, uncluttered feel.
*   **Accessibility:** Transaction tables must support keyboard navigation, handle horizontal overflow cleanly on smaller screens, and include proper screen reader labels.

### Top Section: Wallet Overview
*   **Purpose:** Shows total liquidity and individual wallet balances.
*   **Layout:** Horizontal row of minimalist cards.
*   **Content:** A "Total Balance" card (including a lightweight indicator like "net flow today" or "recent delta"), followed by dynamic cards for each active wallet.

### Middle Section: Category Tracking
*   **Purpose:** Tracks spending against category limits.
*   **Layout:** Clean grid or list of progress bars.
*   **Content:** Shows total spent vs. limit for global categories. 
*   **Visibility:** Governed by the "Preferred Visible Categories" setting for the active wallet.

### Main Section: Transaction History
*   **Purpose:** Full ledger of user activity.
*   **Layout:** Spacious list or clean data table.
*   **Columns/Data:** Date, Type, Amount, Wallet, Category, Payment Method, and Note.

---

## 4. Interaction Flows

**Click-to-Filter Navigation:**
*   **Default State:** Shows total balance across all wallets, all category spending, and the full transaction list.
*   **Active State:** Clicking a specific Wallet Card highlights it. The Category progress bars and Transaction list instantly filter to show *only* data connected to that specific wallet.
*   **Reset:** Clicking the highlighted Wallet Card again clears the filter.

**Filtering & Sorting Details:**
*   **Available Filters:** Date range, transaction type, category, wallet, payment method, amount range, and optional text search for notes.
*   **Sorting:** Default sort is Newest First. Optional sorts include amount ascending/descending. 

**Wallet & Category Creation:**
*   **Add Wallet:** An explicit "Add Wallet" CTA opens a creation modal. Requires a name, starting balance, and optional color selection (restricted to the brand palette).
*   **Category Management:** Creating, editing, or deleting global categories is handled via a dedicated Category Settings modal accessible from this page.

**Transaction Management:**
*   **Add:** Triggers the unified Add Transaction Modal (reusing the exact component from the main dashboard). Requires Wallet, Category, and Payment Method selection.
*   **Edit:** Clicking the inline edit icon opens the modal with pre-filled data.
*   **Delete:** Clicking the trash icon triggers a brief confirmation before executing a soft delete.

**Wallet Management (Settings Overlay):**
*   **Trigger:** A subtle gear icon or ellipsis (`...`) on each Wallet Card.
*   **UI Format:** A slide-out drawer or centered modal overlay.
*   **Available Settings:**
    *   **Wallet Name & Description:** Basic text fields to identify the wallet's purpose.
    *   **Card Color:** A selector to change the wallet card's visual accent.
    *   **Default Payment Method:** A dropdown to set the baseline payment type (e.g., defaulting to "Transfer" for a bank wallet), which auto-populates when adding a new transaction.
    *   **Preferred Visible Categories:** A checklist of global categories. Users can toggle which categories appear in the progress bar list when this specific wallet is selected. 

---

## 5. UI, Empty States & Performance

**Empty State Hierarchy:**
*   **No Wallets:** Display a prominent call-to-action prompting the user to create their first wallet.
*   **No Transactions:** Display a minimalist empty state prompting the user to log their first transaction.

**Loading & Performance Rules:**
*   **Pagination:** Transaction history must be paginated (limit/offset) to avoid rendering huge lists.
*   **Loading UI:** Use skeleton loaders for initial fetches.
*   **Filtering:** Applying filters should use lightweight client-side filtering where possible, avoiding full-page refreshes.
*   **Optimistic Updates:** Allowed for adding/editing transactions to keep the UI feeling fast.

**Visual Tone:** 
Adhere strictly to the "Clear Night Journey" aesthetic (Abyssal Slate, Muted Emerald). Avoid nested cards and heavy colored borders.

---

## 6. System Behaviors & Game Mechanics

*   **Data Guardrails:**
    *   **Future Dates:** Blocked. Shows a brief inline error under the date field.
    *   **Negative Balance:** Overdrawing a debit/cash wallet triggers a warning pop-up ("This will result in a negative balance"). The user can choose to proceed.
    *   **Level Limits:** Hitting wallet/category caps triggers a non-intrusive modal explaining the Level 3 unlock requirement.
*   **Destructive Actions:**
    *   **Delete Transaction:** Triggers a standard confirmation modal before executing a soft delete.
    *   **Delete Wallet:** High-friction confirmation modal requiring the user to type the wallet's name.
    *   **Last Wallet Protection:** The system prevents deleting the final active wallet (button disabled, tooltip explains why).
*   **Game Logic Integration:**
    *   **Expenses:** Immediately reduce the Daily Budget. Pushing over the safe limit instantly triggers the Daily Bleed penalty (HP loss).
    *   **Transfers:** Neutral. Moves balance without triggering HP penalties or granting XP.
    *   **Anti-Cheat:** Editing or deleting an expense from a previous day does not rewrite history. It creates a backend adjustment event. The original Daily Snapshot remains locked, and any HP penalties already taken are not refunded.
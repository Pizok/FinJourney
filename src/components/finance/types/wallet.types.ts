// =============================================================================
// types/wallet.types.ts — FinJourney Wallet Page
//
// Single source of truth for every TypeScript type used on the Wallet page.
// Derived directly from wallet_data_contract.md.
//
// Architecture rule: backend is authoritative for all financial values.
// The frontend only formats what the server returns — it never recalculates
// balance, HP, XP, level, shield, or any other progression value.
//
// Sections:
//   1.  Primitive union types
//   2.  Core domain schemas        (Wallet, Category, Transaction)
//   3.  Pagination & filters
//   4.  Feature unlocks
//   5.  Bootstrap response
//   6.  Mutation payloads
//   7.  API envelope types
//   8.  UI / store state types
//   9.  Derived / selector types
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// 1. Primitive Union Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The structural role of a wallet.
 * Drives icon selection and downstream business-logic hints.
 */
export type WalletType = 'cash' | 'bank' | 'savings' | 'investment' | 'credit' | 'e_wallet';

/**
 * How a transaction was executed.
 * Captured for accurate cash-flow analytics.
 */
export type PaymentMethod =
  | 'cash'
  | 'debit_card'
  | 'credit_card'
  | 'transfer'
  | 'qr_code'
  | 'e_wallet' // legacy
  | 'other';   // legacy

/**
 * The financial nature of a transaction.
 * Drives Daily Bleed, XP grants, and HP logic — all evaluated server-side.
 */
export type TransactionType = 'income' | 'expense' | 'transfer';

/**
 * Available sort orders for the transaction list.
 * Applied to paginated server queries via query params.
 */
export type SortOption =
  | 'newest'
  | 'oldest'
  | 'amount_asc'
  | 'amount_desc';

/**
 * Brand-palette color tokens assignable to a wallet card.
 * Maps 1-to-1 with CSS custom properties in globals.css.
 *
 *   emerald    → --color-muted-emerald
 *   violet     → --color-steel-violet
 *   gold       → --color-dawn-gold
 *   slate      → --color-tactical-border  (neutral option)
 *   terracotta → --color-terracotta
 */
export type ColorToken =
  | 'emerald'
  | 'violet'
  | 'gold'
  | 'slate'
  | 'terracotta';

// ─────────────────────────────────────────────────────────────────────────────
// 2. Core Domain Schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A user-defined recurring fixed expense (rent, internet, gym, etc.).
 * Represents a monthly committed outgoing that is deducted from the
 * projected safe daily budget calculation alongside loan installments.
 */
export interface FixedExpense {
  id: string;
  /** Human-readable name, e.g. "Sewa Kost", "Internet Indihome". */
  name: string;
  /** Monthly cost in IDR. Always > 0. */
  amount: number;
  /**
   * How often this expense recurs.
   *   daily   → no specific target day (recurrence_value = null)
   *   weekly  → recurrence_value = weekday name, e.g. "Monday"
   *   monthly → recurrence_value = day number 1–31, or "last"
   *   yearly  → recurrence_value = "MM-DD" string, e.g. "03-25"
   */
  recurrence_type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  /**
   * Target value for the recurrence, type-dependent (see above).
   * null for daily expenses.
   */
  recurrence_value: string | number | null;
}

/**
 * An active debt/loan being tracked on the Baselines & Debt tab.
 *
 * Progress bar: paid_amount / total_amount (fills muted-emerald as paid off).
 * Remaining balance (total_amount - paid_amount) is displayed in text-terracotta
 * to visually distinguish debt from asset balances.
 */
export interface Loan {
  id: string;
  /** Human-readable name, e.g. "KTA Bank Mandiri", "Cicilan HP". */
  name: string;
  /** Original loan principal in IDR. */
  total_amount: number;
  /** Amount repaid so far. Backend-authoritative. */
  paid_amount: number;
  /** ISO 8601 date string for the next scheduled payment. */
  next_due_date: string;
  /** Fixed monthly installment amount. */
  monthly_installment: number;
}

/**
 * Financial baseline assumptions owned by the Wallet domain.
 * Drives the Projected Safe Daily Budget calculation:
 *   (income − fixed_costs_total − savings) / 30
 */
export interface FinancialAssumptions {
  expected_monthly_income: number;
  monthly_savings_target: number;
  /** Read-only preview, derived client-side. Server value is authoritative on save. */
  projected_safe_daily_budget: number;
}

/**
 * A user-owned financial container.
 *
 * Wallets answer: WHERE was the money held / moved from?
 * Categories answer: WHAT was the money spent on?
 *
 * These are distinct concepts. A single expense can have one wallet
 * (source of funds) and one category (spending classification).
 */
export interface Wallet {
  id: string;
  name: string;
  /** Optional free-text description of the wallet's purpose. */
  description?: string;
  type: WalletType;
  /**
   * Current balance in the user's local currency.
   * Backend-authoritative: the frontend never adds or subtracts from this.
   */
  balance: number;
  /** Brand palette token for the wallet card's visual accent. */
  color_token: ColorToken;
  /**
   * Pre-populates the payment method field when this wallet is selected
   * during transaction creation.
   */
  default_payment_method: PaymentMethod;
  /**
   * IDs of global categories shown in the Category Tracking section
   * when this wallet is the active filter.
   * Empty array = show no categories for this wallet.
   */
  visible_category_ids: string[];
  /** ISO 8601 timestamp of wallet creation. */
  created_at: string;
}

/**
 * A global spending category with its monthly limit and current-period usage.
 *
 * Categories are NOT per-wallet — they are shared across all wallets.
 * All numeric fields (spent, remaining, percentage) are backend-calculated.
 * The frontend only renders them.
 */
export interface Category {
  id: string;
  name: string;
  /** User-configured monthly spend ceiling. */
  monthly_limit: number;
  /** Total spent against this category this month — backend-calculated. */
  spent_amount: number;
  /** monthly_limit minus spent_amount — backend-calculated, never derived on client. */
  remaining_amount: number;
  /** 0–100. Drives progress bar width. Backend-calculated. */
  progress_percentage: number;
}

/**
 * A single financial event in the immutable ledger.
 *
 * Transfer rules (from logic.md):
 *   - Transfers move balance between wallets only.
 *   - They do NOT grant XP.
 *   - They do NOT trigger Daily Bleed HP loss.
 *
 * Soft-delete rule: transactions are never hard-deleted. Removing one
 * creates a backend adjustment event; the original row is preserved.
 *
 * Adjustment events (is_adjustment_event: true) are correction entries.
 * They should render differently in the UI (e.g. dimmed, italic note).
 */
export interface Transaction {
  id: string;
  type: TransactionType;
  /** Always > 0. Sign is inferred from `type`. */
  amount: number;
  wallet_id?: string;
  /** Denormalised wallet name — avoids a join in the UI. */
  wallet_name?: string;
  source_wallet_id?: string;
  destination_wallet_id?: string;
  /** Not present on transfers (no category required). */
  category_id?: string;
  category_name?: string;
  payment_method: PaymentMethod;
  /** Optional free-text note attached to the transaction. */
  note?: string;
  /** ISO 8601. Frontend blocks future-dated submissions; server enforces. */
  created_at: string;
  /** Set when the transaction has been edited. */
  updated_at?: string;
  /**
   * True when this row was generated by editing or deleting an older
   * transaction. The original daily_snapshot is locked; HP already taken
   * is NOT reversed.
   */
  is_adjustment_event: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Pagination & Filters
// ─────────────────────────────────────────────────────────────────────────────

/** Cursor-style pagination metadata returned with every transaction page. */
export interface Pagination {
  page: number;
  /** Rows per page. Default: 20. */
  limit: number;
  total_items: number;
  total_pages: number;
}

/**
 * Client-side filter state.
 * Serialised into query params on paginated transaction fetches.
 * Persisted in the Zustand store so filters survive component re-mounts.
 */
export interface FilterState {
  wallet_id?: string;
  transaction_type?: TransactionType;
  category_id?: string;
  payment_method?: PaymentMethod;
  /** ISO 8601 date string (date part only). */
  start_date?: string;
  end_date?: string;
  min_amount?: number;
  max_amount?: number;
  /** Matches against the transaction's `note` field. */
  search?: string;
  sort?: SortOption;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Feature Unlocks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Level-gated feature flags returned by the bootstrap endpoint.
 *
 * The UI reads these flags to decide what to enable / disable / lock.
 * Level is NEVER inferred client-side from XP; the server provides
 * the flags directly.
 *
 * Level 1 defaults: max 3 wallets, max 10 categories.
 * Level 3 unlocks: unlimited wallets, unlimited categories, analytics.
 */
export interface FeatureUnlocks {
  /** True when the user can create additional wallets. */
  can_create_wallet: boolean;
  /** True when the user can create additional categories. */
  can_create_category: boolean;
  /** Hard cap on wallets at the user's current level. */
  max_wallets: number;
  /** Hard cap on categories at the user's current level. */
  max_categories: number;
  /** True when the analytics section (Level 3) is accessible. */
  analytics_unlocked: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Bootstrap Response
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full hydration payload from GET /api/v1/wallet/bootstrap.
 * Populates the entire Wallet page in a single round trip.
 *
 * `recent_transactions` is the first page (limit 20, newest-first).
 * Subsequent pages are fetched client-side via the pagination API.
 */
export interface WalletBootstrapResponse {
  wallets: Wallet[];
  category_limits: Category[];
  recent_transactions: Transaction[];
  pagination: Pagination;
  /** Last-used filter state, persisted server-side per user. */
  active_filters: FilterState;
  feature_unlocks: FeatureUnlocks;
  /** Recurring fixed costs (rent, internet, etc.) — used in Baselines & Debt tab. */
  fixed_expenses: FixedExpense[];
  /** Active loans/debts — used in Baselines & Debt tab with progress bar display. */
  active_loans: Loan[];
  /** Income & savings assumptions for the daily budget calculation. */
  financial_assumptions: FinancialAssumptions;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Mutation Payloads
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/v1/transactions */
export interface AddTransactionPayload {
  type: TransactionType;
  /** Must be > 0. The sign is determined by `type`. */
  amount: number;
  wallet_id: string;
  category_id?: string;
  payment_method: PaymentMethod;
  note?: string;
  /** ISO 8601 date string. Future dates are blocked. */
  transaction_date: string;
}

/**
 * PATCH /api/v1/transactions/:id
 *
 * Only these four fields are editable post-creation.
 * Editing any of them on a historical transaction generates an adjustment
 * event in game_events — it does NOT rewrite the original snapshot.
 */
export interface EditTransactionPayload {
  amount?: number;
  category_id?: string;
  note?: string;
  payment_method?: PaymentMethod;
}

/** POST /api/v1/wallets */
export interface WalletCreationPayload {
  name: string;
  /** Opening balance. Must be >= 0. */
  starting_balance: number;
  color_token?: ColorToken;
  description?: string;
}

/** PATCH /api/v1/wallets/:id */
export interface WalletSettingsPayload {
  name?: string;
  description?: string;
  color_token?: ColorToken;
  default_payment_method?: PaymentMethod;
  /** Replaces the entire visible_category_ids array. */
  visible_category_ids?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. API Envelope Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    /** Present when the error maps to a specific form field. */
    field?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─────────────────────────────────────────────────────────────────────────────
// 8. UI / Store State Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Section-level loading flags.
 * Allows each page section to show its own skeleton independently
 * rather than blocking the whole page behind a single spinner.
 */
export interface LoadingState {
  /** True while GET /api/v1/wallet/bootstrap is in flight. */
  bootstrap: boolean;
  /** True while a paginated transaction fetch is in flight. */
  transactions: boolean;
  /** True while category data is refreshing. */
  categories: boolean;
  /** True while any create / edit / delete mutation is in flight. */
  mutation: boolean;
  /** True while baselines (fixed expenses / loans / assumptions) are saving. */
  baselines: boolean;
}

/**
 * All transient client-only UI state.
 *
 * Design rule: no progression values live here. HP, XP, level, gold,
 * and shield come from the server and are read-only from the client's
 * perspective. This store only manages what the server cannot.
 */
export interface WalletUIState {
  /**
   * Active wallet ID for click-to-filter navigation.
   * null = global view (all wallets shown).
   */
  selectedWalletId: string | null;

  // Modal open/close flags ────────────────────────────────────────────────
  isAddTransactionOpen: boolean;
  isEditTransactionOpen: boolean;
  isDeleteTransactionOpen: boolean;
  isAddWalletOpen: boolean;
  isWalletSettingsOpen: boolean;
  isDeleteWalletOpen: boolean;

  // Active entity IDs (which record a modal is operating on) ────────────
  activeEditTransactionId: string | null;
  activeDeleteTransactionId: string | null;
  activeSettingsWalletId: string | null;
  activeDeleteWalletId: string | null;

  /** Top-level error message for fetch failures. Field-level errors live in forms. */
  globalError: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Derived / Selector Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shape returned by store selectors.
 * Computed at read time — never stored directly in Zustand state.
 */
export interface WalletDerivedState {
  /** The Wallet object for the current selectedWalletId, or null (global view). */
  activeWallet: Wallet | null;
  /** Sum of all wallet balances. Display-only; backend is authoritative. */
  totalBalance: number;
  /**
   * Transactions filtered by selectedWalletId + active FilterState.
   * Used for immediate UI feedback; full server pagination is still used
   * for complete data.
   */
  filteredTransactions: Transaction[];
  /**
   * Categories filtered by activeWallet.visible_category_ids.
   * Returns all categories when no wallet is selected.
   */
  visibleCategories: Category[];
}

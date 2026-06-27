// =============================================================================
// stores/walletStore.ts — FinJourney Wallet Page
//
// Zustand store: the single client-side authority for all Wallet page state.
//
// Architecture rules (from logic.md + wallet_data_contract.md):
//   • Backend is authoritative for balances, XP, HP, level, penalties.
//   • This store only manages: bootstrap data shape, UI flags, optimistic
//     mutations, filter/pagination state, and loading indicators.
//   • All progression values (HP/XP/level/gold) are read-only here.
//   • Soft deletes only — no hard removes from the server.
//   • Transfer transactions: no XP, no HP penalty.
//
// Structure:
//   ① MOCK DATA          — realistic IDR data for local development
//   ② STORE STATE        — interface and default values
//   ③ STORE IMPL         — create() with all actions
//   ④ SELECTORS          — pure computed functions, exported for components
// =============================================================================

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import type {
  Wallet,
  Category,
  Transaction,
  Pagination,
  FilterState,
  FeatureUnlocks,
  WalletBootstrapResponse,
  WalletUIState,
  LoadingState,
  FixedExpense,
  Loan,
  FinancialAssumptions,
} from '@/types/wallet.types';

// ─────────────────────────────────────────────────────────────────────────────
// ② STORE STATE — interface and defaults
// ─────────────────────────────────────────────────────────────────────────────

interface WalletStore {
  // Server state (hydrated from bootstrap / API) ────────────────────────────
  wallets: Wallet[];
  categories: Category[];
  transactions: Transaction[];
  pagination: Pagination;
  featureUnlocks: FeatureUnlocks;
  fixedExpenses: FixedExpense[];
  loans: Loan[];
  financialAssumptions: FinancialAssumptions;
  /** True once the bootstrap payload has been loaded (real or mock). */
  isBootstrapped: boolean;

  // Filter state ─────────────────────────────────────────────────────────────
  filterState: FilterState;

  // UI state ─────────────────────────────────────────────────────────────────
  ui: WalletUIState & {
    isCategoryModalOpen: boolean;
    activeEditCategoryId: string | null;
  };

  // Loading flags ────────────────────────────────────────────────────────────
  loading: LoadingState;

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  /**
   * Hydrates the store from a WalletBootstrapResponse.
   * Called once on page mount after the real API responds.
   */
  hydrate: (data: WalletBootstrapResponse) => void;

  // ── Wallet selection ──────────────────────────────────────────────────────

  /**
   * Activates click-to-filter for a specific wallet.
   * Passing the same ID a second time clears the filter (toggle behaviour).
   */
  selectWallet: (walletId: string) => void;
  /** Resets to the global view (no wallet filter). */
  clearWalletSelection: () => void;

  // ── Filters & pagination ──────────────────────────────────────────────────

  setFilter: (partial: Partial<FilterState>) => void;
  clearFilters: () => void;
  setPage: (page: number) => void;

  // ── Transaction mutations ─────────────────────────────────────────────────

  /**
   * Prepends a transaction to the visible list before server confirmation.
   * Use a temporary ID (e.g. crypto.randomUUID()) that gets replaced by
   * confirmTransaction() once the server responds.
   */
  optimisticAddTransaction: (tx: Transaction) => void;
  /** Swaps a temporary optimistic row for the confirmed server record. */
  confirmTransaction: (tempId: string, confirmed: Transaction) => void;
  /** Removes a temporary row on mutation failure. */
  rollbackTransaction: (tempId: string) => void;
  /** Updates an existing row in-place before server confirmation. */
  optimisticUpdateTransaction: (id: string, patch: Partial<Transaction>) => void;
  /**
   * Removes a transaction from the visible list.
   * The server executes a soft delete and creates an adjustment event.
   */
  optimisticDeleteTransaction: (id: string) => void;
  /** Replaces the transaction list with a fresh server page. */
  setTransactions: (transactions: Transaction[], pagination: Pagination) => void;

  // ── Baselines mutations ────────────────────────────────────────────

  setFixedExpenses: (expenses: FixedExpense[]) => void;
  addFixedExpense: (expense: FixedExpense) => void;
  removeFixedExpense: (id: string) => void;

  setLoans: (loans: Loan[]) => void;
  addLoan: (loan: Loan) => void;
  removeLoan: (id: string) => void;

  updateFinancialAssumptions: (patch: Partial<FinancialAssumptions>) => void;

  // ── Wallet mutations ──────────────────────────────────────────────────────

  addWallet: (wallet: Wallet) => void;
  updateWallet: (id: string, patch: Partial<Wallet>) => void;
  removeWallet: (id: string) => void;

  // ── Category mutations ────────────────────────────────────────────────────

  setCategories: (categories: Category[]) => void;
  addCategory: (category: Category) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  removeCategory: (id: string) => void;
  restoreCategory: (category: Category) => void;

  // ── Modal controls ────────────────────────────────────────────────────────

  openAddTransaction: () => void;
  closeAddTransaction: () => void;
  openEditTransaction: (transactionId: string) => void;
  closeEditTransaction: () => void;
  openDeleteTransaction: (transactionId: string) => void;
  closeDeleteTransaction: () => void;
  openAddWallet: () => void;
  closeAddWallet: () => void;
  openWalletSettings: (walletId: string) => void;
  closeWalletSettings: () => void;
  openDeleteWallet: (walletId: string) => void;
  closeDeleteWallet: () => void;
  openAddCategory: () => void;
  openEditCategory: (categoryId: string) => void;
  closeCategoryModal: () => void;

  // ── Error / loading ───────────────────────────────────────────────────────

  setGlobalError: (message: string | null) => void;
  setLoading: (key: keyof LoadingState, value: boolean) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default slices
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_UI: WalletUIState & { isCategoryModalOpen: boolean; activeEditCategoryId: string | null; } = {
  selectedWalletId: null,
  isAddTransactionOpen: false,
  isEditTransactionOpen: false,
  isDeleteTransactionOpen: false,
  isAddWalletOpen: false,
  isWalletSettingsOpen: false,
  isDeleteWalletOpen: false,
  activeEditTransactionId: null,
  activeDeleteTransactionId: null,
  activeSettingsWalletId: null,
  activeDeleteWalletId: null,
  globalError: null,
  isCategoryModalOpen: false,
  activeEditCategoryId: null,
};

const DEFAULT_LOADING: LoadingState = {
  bootstrap: true,
  transactions: false,
  categories: false,
  mutation: false,
  baselines: false,
};

const DEFAULT_PAGINATION: Pagination = {
  page: 1,
  limit: 20,
  total_items: 0,
  total_pages: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// ③ STORE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

export const useWalletStore = create<WalletStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // ── Initial state ──────────────────────────────────────────────────────
      wallets: [],
      categories: [],
      transactions: [],
      pagination: DEFAULT_PAGINATION,
      featureUnlocks: {
        can_create_wallet: false,
        can_create_category: false,
        max_wallets: 3,
        max_categories: 10,
        analytics_unlocked: false,
      },
      fixedExpenses: [],
      loans: [],
      financialAssumptions: {
        expected_monthly_income: 0,
        monthly_savings_target: 0,
        projected_safe_daily_budget: 0,
      },
      isBootstrapped: false,
      filterState: { sort: 'newest' },
      ui: DEFAULT_UI,
      loading: DEFAULT_LOADING,

      // ── Bootstrap ──────────────────────────────────────────────────────────

      hydrate: (data) =>
        set(
          {
            wallets: data.wallets,
            categories: data.category_limits,
            transactions: data.recent_transactions,
            pagination: data.pagination,
            featureUnlocks: data.feature_unlocks,
            filterState: data.active_filters ?? { sort: 'newest' },
            fixedExpenses: data.fixed_expenses ?? [],
            loans: data.active_loans ?? [],
            financialAssumptions: data.financial_assumptions ?? {
              expected_monthly_income: 0,
              monthly_savings_target: 0,
              projected_safe_daily_budget: 0,
            },
            isBootstrapped: true,
          },
          false,
          'wallet/hydrate',
        ),

      // ── Wallet selection ──────────────────────────────────────────────────

      selectWallet: (walletId) =>
        set(
          (s) => ({
            ui: {
              ...s.ui,
              selectedWalletId:
                s.ui.selectedWalletId === walletId ? null : walletId,
            },
            pagination: { ...s.pagination, page: 1 },
          }),
          false,
          'wallet/selectWallet',
        ),

      clearWalletSelection: () =>
        set(
          (s) => ({
            ui: { ...s.ui, selectedWalletId: null },
            pagination: { ...s.pagination, page: 1 },
          }),
          false,
          'wallet/clearWalletSelection',
        ),

      // ── Filters & pagination ──────────────────────────────────────────────

      setFilter: (partial) =>
        set(
          (s) => ({
            filterState: { ...s.filterState, ...partial },
            pagination: { ...s.pagination, page: 1 },
          }),
          false,
          'wallet/setFilter',
        ),

      clearFilters: () =>
        set(
          (s) => ({
            filterState: { sort: 'newest' },
            pagination: { ...s.pagination, page: 1 },
          }),
          false,
          'wallet/clearFilters',
        ),

      setPage: (page) =>
        set(
          (s) => ({ pagination: { ...s.pagination, page } }),
          false,
          'wallet/setPage',
        ),

      // ── Transaction mutations ──────────────────────────────────────────────

      optimisticAddTransaction: (tx) =>
        set(
          (s) => ({ transactions: [tx, ...s.transactions] }),
          false,
          'wallet/optimisticAddTransaction',
        ),

      confirmTransaction: (tempId, confirmed) =>
        set(
          (s) => ({
            transactions: s.transactions.map((t) =>
              t.id === tempId ? confirmed : t,
            ),
          }),
          false,
          'wallet/confirmTransaction',
        ),

      rollbackTransaction: (tempId) =>
        set(
          (s) => ({
            transactions: s.transactions.filter((t) => t.id !== tempId),
          }),
          false,
          'wallet/rollbackTransaction',
        ),

      optimisticUpdateTransaction: (id, patch) =>
        set(
          (s) => ({
            transactions: s.transactions.map((t) =>
              t.id === id ? { ...t, ...patch } : t,
            ),
          }),
          false,
          'wallet/optimisticUpdateTransaction',
        ),

      optimisticDeleteTransaction: (id) =>
        set(
          (s) => ({
            transactions: s.transactions.filter((t) => t.id !== id),
          }),
          false,
          'wallet/optimisticDeleteTransaction',
        ),

      setTransactions: (transactions, pagination) =>
        set({ transactions, pagination }, false, 'wallet/setTransactions'),

      // ── Baselines mutations ─────────────────────────────────────────────────

      setFixedExpenses: (expenses) =>
        set({ fixedExpenses: expenses }, false, 'wallet/setFixedExpenses'),

      addFixedExpense: (expense) =>
        set(
          (s) => ({ fixedExpenses: [...s.fixedExpenses, expense] }),
          false,
          'wallet/addFixedExpense',
        ),

      removeFixedExpense: (id) =>
        set(
          (s) => ({ fixedExpenses: s.fixedExpenses.filter((e) => e.id !== id) }),
          false,
          'wallet/removeFixedExpense',
        ),

      setLoans: (loans) =>
        set({ loans }, false, 'wallet/setLoans'),

      addLoan: (loan) =>
        set(
          (s) => ({ loans: [...s.loans, loan] }),
          false,
          'wallet/addLoan',
        ),

      removeLoan: (id) =>
        set(
          (s) => ({ loans: s.loans.filter((l) => l.id !== id) }),
          false,
          'wallet/removeLoan',
        ),

      updateFinancialAssumptions: (patch) =>
        set(
          (s) => {
            const merged = { ...s.financialAssumptions, ...patch };
            // Derive live daily budget preview client-side.
            // Backend is authoritative on save.
            const totalFixed =
              s.fixedExpenses.reduce((sum, e) => sum + e.amount, 0) +
              s.loans.reduce((sum, l) => sum + l.monthly_installment, 0);
            const raw =
              (merged.expected_monthly_income - totalFixed - merged.monthly_savings_target) / 30;
            return {
              financialAssumptions: {
                ...merged,
                projected_safe_daily_budget: Math.max(0, Math.round(raw)),
              },
            };
          },
          false,
          'wallet/updateFinancialAssumptions',
        ),

      // ── Wallet mutations ───────────────────────────────────────────────────


      addWallet: (wallet) =>
        set(
          (s) => ({ wallets: [...s.wallets, wallet] }),
          false,
          'wallet/addWallet',
        ),

      updateWallet: (id, patch) =>
        set(
          (s) => ({
            wallets: s.wallets.map((w) =>
              w.id === id ? { ...w, ...patch } : w,
            ),
          }),
          false,
          'wallet/updateWallet',
        ),

      removeWallet: (id) =>
        set(
          (s) => ({
            wallets: s.wallets.filter((w) => w.id !== id),
            // Clear selection if the deleted wallet was active
            ui: {
              ...s.ui,
              selectedWalletId:
                s.ui.selectedWalletId === id ? null : s.ui.selectedWalletId,
            },
          }),
          false,
          'wallet/removeWallet',
        ),

      // ── Category mutations ─────────────────────────────────────────────────

      setCategories: (categories) =>
        set({ categories }, false, 'wallet/setCategories'),

      addCategory: (category) =>
        set(
          (s) => ({ categories: [...s.categories, category] }),
          false,
          'wallet/addCategory',
        ),

      updateCategory: (id, patch) =>
        set(
          (s) => ({
            categories: s.categories.map((c) =>
              c.id === id ? { ...c, ...patch } : c,
            ),
          }),
          false,
          'wallet/updateCategory',
        ),

      removeCategory: (id) =>
        set(
          (s) => ({
            categories: s.categories.filter((c) => c.id !== id),
          }),
          false,
          'wallet/removeCategory',
        ),

      restoreCategory: (category) =>
        set(
          (s) => ({
            categories: [...s.categories, category], // Put it back at the end on rollback
          }),
          false,
          'wallet/restoreCategory',
        ),

      // ── Modal controls ─────────────────────────────────────────────────────

      openAddTransaction: () =>
        set(
          (s) => ({ ui: { ...s.ui, isAddTransactionOpen: true } }),
          false,
          'wallet/openAddTransaction',
        ),
      closeAddTransaction: () =>
        set(
          (s) => ({ ui: { ...s.ui, isAddTransactionOpen: false } }),
          false,
          'wallet/closeAddTransaction',
        ),

      openEditTransaction: (id) =>
        set(
          (s) => ({
            ui: {
              ...s.ui,
              isEditTransactionOpen: true,
              activeEditTransactionId: id,
            },
          }),
          false,
          'wallet/openEditTransaction',
        ),
      closeEditTransaction: () =>
        set(
          (s) => ({
            ui: {
              ...s.ui,
              isEditTransactionOpen: false,
              activeEditTransactionId: null,
            },
          }),
          false,
          'wallet/closeEditTransaction',
        ),

      openDeleteTransaction: (id) =>
        set(
          (s) => ({
            ui: {
              ...s.ui,
              isDeleteTransactionOpen: true,
              activeDeleteTransactionId: id,
            },
          }),
          false,
          'wallet/openDeleteTransaction',
        ),
      closeDeleteTransaction: () =>
        set(
          (s) => ({
            ui: {
              ...s.ui,
              isDeleteTransactionOpen: false,
              activeDeleteTransactionId: null,
            },
          }),
          false,
          'wallet/closeDeleteTransaction',
        ),

      openAddWallet: () =>
        set(
          (s) => ({ ui: { ...s.ui, isAddWalletOpen: true } }),
          false,
          'wallet/openAddWallet',
        ),
      closeAddWallet: () =>
        set(
          (s) => ({ ui: { ...s.ui, isAddWalletOpen: false } }),
          false,
          'wallet/closeAddWallet',
        ),

      openWalletSettings: (id) =>
        set(
          (s) => ({
            ui: {
              ...s.ui,
              isWalletSettingsOpen: true,
              activeSettingsWalletId: id,
            },
          }),
          false,
          'wallet/openWalletSettings',
        ),
      closeWalletSettings: () =>
        set(
          (s) => ({
            ui: {
              ...s.ui,
              isWalletSettingsOpen: false,
              activeSettingsWalletId: null,
            },
          }),
          false,
          'wallet/closeWalletSettings',
        ),

      openDeleteWallet: (id) =>
        set(
          (s) => ({
            ui: {
              ...s.ui,
              isDeleteWalletOpen: true,
              activeDeleteWalletId: id,
            },
          }),
          false,
          'wallet/openDeleteWallet',
        ),
      closeDeleteWallet: () =>
        set(
          (s) => ({
            ui: {
              ...s.ui,
              isDeleteWalletOpen: false,
              activeDeleteWalletId: null,
            },
          }),
          false,
          'wallet/closeDeleteWallet',
        ),

      openAddCategory: () =>
        set(
          (s) => ({ ui: { ...s.ui, isCategoryModalOpen: true, activeEditCategoryId: null } }),
          false,
          'wallet/openAddCategory',
        ),
      openEditCategory: (id) =>
        set(
          (s) => ({
            ui: {
              ...s.ui,
              isCategoryModalOpen: true,
              activeEditCategoryId: id,
            },
          }),
          false,
          'wallet/openEditCategory',
        ),
      closeCategoryModal: () =>
        set(
          (s) => ({
            ui: {
              ...s.ui,
              isCategoryModalOpen: false,
              activeEditCategoryId: null,
            },
          }),
          false,
          'wallet/closeCategoryModal',
        ),

      // ── Error / loading ────────────────────────────────────────────────────

      setGlobalError: (message) =>
        set(
          (s) => ({ ui: { ...s.ui, globalError: message } }),
          false,
          'wallet/setGlobalError',
        ),

      setLoading: (key, value) =>
        set(
          (s) => ({ loading: { ...s.loading, [key]: value } }),
          false,
          `wallet/loading/${key}`,
        ),
    })),
    { name: 'FinJourney:WalletStore' },
  ),
);

// ─────────────────────────────────────────────────────────────────────────────
// ④ SELECTORS
//
// Pure functions that derive values from the store state.
// Use these in components via:
//   const totalBalance = useWalletStore(selectTotalBalance);
//
// This pattern prevents unnecessary re-renders — the component only re-renders
// when the derived value changes, not on every store mutation.
// ─────────────────────────────────────────────────────────────────────────────

/** The currently selected Wallet object, or null when in global view. */
export const selectActiveWallet = (s: WalletStore): Wallet | null =>
  s.ui.selectedWalletId
    ? (s.wallets.find((w) => w.id === s.ui.selectedWalletId) ?? null)
    : null;

/**
 * Sum of all wallet balances.
 * Display-only — the backend is the source of truth for each wallet.balance.
 */
export const selectTotalBalance = (s: WalletStore): number =>
  s.wallets.reduce((sum, w) => sum + w.balance, 0);

/**
 * Categories filtered by the active wallet's visible_category_ids.
 * Returns all categories when no wallet is selected (global view).
 */
export const selectVisibleCategories = (s: WalletStore) => {
  const active = selectActiveWallet(s);
  if (!active) return s.categories;
  return s.categories.filter((c) =>
    active.visible_category_ids.includes(c.id),
  );
};

/**
 * Transactions filtered by the active wallet + active filter state.
 * This is a client-side subset of the full server data.
 * Pagination fetches the authoritative full set from the server.
 */
export const selectFilteredTransactions = (s: WalletStore): Transaction[] => {
  const {
    ui: { selectedWalletId },
    filterState: { transaction_type, category_id, payment_method, search, sort },
    transactions,
  } = s;

  const filtered = transactions.filter((t) => {
    if (selectedWalletId && t.wallet_id !== selectedWalletId) return false;
    if (transaction_type && t.type !== transaction_type) return false;
    if (category_id && t.category_id !== category_id) return false;
    if (payment_method && t.payment_method !== payment_method) return false;
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      const inNote = t.note?.toLowerCase().includes(q) ?? false;
      const inCategory = t.category_name?.toLowerCase().includes(q) ?? false;
      const inWallet = (t.wallet_name || '').toLowerCase().includes(q);
      if (!inNote && !inCategory && !inWallet) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    switch (sort) {
      case 'oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'amount_desc':
        return b.amount - a.amount;
      case 'amount_asc':
        return a.amount - b.amount;
      case 'newest':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });
};

/** The Transaction currently open in the edit modal. */
export const selectEditTransaction = (s: WalletStore): Transaction | null =>
  s.ui.activeEditTransactionId
    ? (s.transactions.find((t) => t.id === s.ui.activeEditTransactionId) ?? null)
    : null;

/** The Wallet whose settings modal is open. */
export const selectSettingsWallet = (s: WalletStore): Wallet | null =>
  s.ui.activeSettingsWalletId
    ? (s.wallets.find((w) => w.id === s.ui.activeSettingsWalletId) ?? null)
    : null;

/** The Wallet targeted by the delete confirmation modal. */
export const selectDeleteWallet = (s: WalletStore): Wallet | null =>
  s.ui.activeDeleteWalletId
    ? (s.wallets.find((w) => w.id === s.ui.activeDeleteWalletId) ?? null)
    : null;

/** The Category currently open in the edit modal. */
export const selectEditCategory = (s: WalletStore): Category | null =>
  s.ui.activeEditCategoryId
    ? (s.categories.find((c) => c.id === s.ui.activeEditCategoryId) ?? null)
    : null;

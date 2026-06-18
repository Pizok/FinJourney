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
} from '@/types/wallet.types';

// ─────────────────────────────────────────────────────────────────────────────
// ① MOCK DATA
//
// Realistic IDR-denominated data for a Level 1 user (Asia/Jakarta timezone).
// Matches the exact WalletBootstrapResponse shape from wallet_data_contract.md.
// Replace with real API data by calling hydrate() with the server response.
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_WALLETS: Wallet[] = [
  {
    id: 'wlt-001',
    name: 'Tunai',
    description: 'Uang tunai untuk kebutuhan harian',
    type: 'cash',
    balance: 875_000,
    color_token: 'emerald',
    default_payment_method: 'cash',
    visible_category_ids: ['cat-001', 'cat-002', 'cat-007', 'cat-010'],
    created_at: '2025-01-15T00:00:00Z',
  },
  {
    id: 'wlt-002',
    name: 'BCA Tabungan',
    description: 'Rekening utama untuk gaji dan tagihan',
    type: 'bank',
    balance: 12_480_000,
    color_token: 'violet',
    default_payment_method: 'transfer',
    visible_category_ids: [
      'cat-001', 'cat-003', 'cat-004', 'cat-005',
      'cat-006', 'cat-008', 'cat-009',
    ],
    created_at: '2025-01-15T00:00:00Z',
  },
  {
    id: 'wlt-003',
    name: 'GoPay',
    description: 'Dompet digital untuk transportasi dan belanja online',
    type: 'bank',
    balance: 445_000,
    color_token: 'gold',
    default_payment_method: 'debit_card',
    visible_category_ids: ['cat-001', 'cat-002', 'cat-003', 'cat-010'],
    created_at: '2025-01-15T00:00:00Z',
  },
];

const MOCK_CATEGORIES: Category[] = [
  {
    id: 'cat-001',
    name: 'Makanan & Minuman',
    monthly_limit: 1_500_000,
    spent_amount: 920_000,
    remaining_amount: 580_000,
    progress_percentage: 61,
  },
  {
    id: 'cat-002',
    name: 'Transportasi',
    monthly_limit: 500_000,
    spent_amount: 385_000,
    remaining_amount: 115_000,
    progress_percentage: 77,
  },
  {
    id: 'cat-003',
    name: 'Belanja',
    monthly_limit: 1_000_000,
    spent_amount: 640_000,
    remaining_amount: 360_000,
    progress_percentage: 64,
  },
  {
    id: 'cat-004',
    name: 'Tagihan & Utilitas',
    monthly_limit: 800_000,
    spent_amount: 800_000,
    remaining_amount: 0,
    progress_percentage: 100,
  },
  {
    id: 'cat-005',
    name: 'Hiburan',
    monthly_limit: 400_000,
    spent_amount: 145_000,
    remaining_amount: 255_000,
    progress_percentage: 36,
  },
  {
    id: 'cat-006',
    name: 'Kesehatan',
    monthly_limit: 300_000,
    spent_amount: 0,
    remaining_amount: 300_000,
    progress_percentage: 0,
  },
  {
    id: 'cat-007',
    name: 'Pendidikan',
    monthly_limit: 200_000,
    spent_amount: 50_000,
    remaining_amount: 150_000,
    progress_percentage: 25,
  },
  {
    id: 'cat-008',
    name: 'Langganan Digital',
    monthly_limit: 250_000,
    spent_amount: 215_000,
    remaining_amount: 35_000,
    progress_percentage: 86,
  },
  {
    id: 'cat-009',
    name: 'Rumah & Perabot',
    monthly_limit: 600_000,
    spent_amount: 240_000,
    remaining_amount: 360_000,
    progress_percentage: 40,
  },
  {
    id: 'cat-010',
    name: 'Sosial',
    monthly_limit: 300_000,
    spent_amount: 90_000,
    remaining_amount: 210_000,
    progress_percentage: 30,
  },
];

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-001',
    type: 'expense',
    amount: 48_000,
    wallet_id: 'wlt-001',
    wallet_name: 'Tunai',
    category_id: 'cat-001',
    category_name: 'Makanan & Minuman',
    payment_method: 'cash',
    note: 'Makan siang warung padang',
    created_at: '2025-05-30T12:10:00Z',
    is_adjustment_event: false,
  },
  {
    id: 'tx-002',
    type: 'expense',
    amount: 38_000,
    wallet_id: 'wlt-003',
    wallet_name: 'GoPay',
    category_id: 'cat-002',
    category_name: 'Transportasi',
    payment_method: 'debit_card',
    note: 'Gojek pagi ke kantor',
    created_at: '2025-05-30T07:45:00Z',
    is_adjustment_event: false,
  },
  {
    id: 'tx-003',
    type: 'transfer',
    amount: 500_000,
    wallet_id: 'wlt-002',
    wallet_name: 'BCA Tabungan',
    payment_method: 'transfer',
    note: 'Top up GoPay bulanan',
    created_at: '2025-05-29T09:00:00Z',
    is_adjustment_event: false,
  },
  {
    id: 'tx-004',
    type: 'expense',
    amount: 215_000,
    wallet_id: 'wlt-002',
    wallet_name: 'BCA Tabungan',
    category_id: 'cat-008',
    category_name: 'Langganan Digital',
    payment_method: 'debit_card',
    note: 'Netflix + Spotify + YouTube Premium',
    created_at: '2025-05-28T10:00:00Z',
    is_adjustment_event: false,
  },
  {
    id: 'tx-005',
    type: 'income',
    amount: 15_000_000,
    wallet_id: 'wlt-002',
    wallet_name: 'BCA Tabungan',
    payment_method: 'transfer',
    note: 'Gaji Mei 2025',
    created_at: '2025-05-27T09:00:00Z',
    is_adjustment_event: false,
  },
  {
    id: 'tx-006',
    type: 'expense',
    amount: 335_000,
    wallet_id: 'wlt-002',
    wallet_name: 'BCA Tabungan',
    category_id: 'cat-003',
    category_name: 'Belanja',
    payment_method: 'debit_card',
    note: 'Uniqlo — baju kantor',
    created_at: '2025-05-27T15:20:00Z',
    is_adjustment_event: false,
  },
  {
    id: 'tx-007',
    type: 'expense',
    amount: 800_000,
    wallet_id: 'wlt-002',
    wallet_name: 'BCA Tabungan',
    category_id: 'cat-004',
    category_name: 'Tagihan & Utilitas',
    payment_method: 'transfer',
    note: 'PLN + PDAM + internet Indihome',
    created_at: '2025-05-26T11:00:00Z',
    is_adjustment_event: false,
  },
  {
    id: 'tx-008',
    type: 'expense',
    amount: 72_000,
    wallet_id: 'wlt-001',
    wallet_name: 'Tunai',
    category_id: 'cat-001',
    category_name: 'Makanan & Minuman',
    payment_method: 'cash',
    note: 'Kopi + kue kantor',
    created_at: '2025-05-26T10:30:00Z',
    is_adjustment_event: false,
  },
  {
    id: 'tx-009',
    type: 'expense',
    amount: 145_000,
    wallet_id: 'wlt-003',
    wallet_name: 'GoPay',
    category_id: 'cat-005',
    category_name: 'Hiburan',
    payment_method: 'debit_card',
    note: 'CGV — nonton bareng',
    created_at: '2025-05-25T19:30:00Z',
    is_adjustment_event: false,
  },
  {
    id: 'tx-010',
    type: 'expense',
    amount: 90_000,
    wallet_id: 'wlt-001',
    wallet_name: 'Tunai',
    category_id: 'cat-010',
    category_name: 'Sosial',
    payment_method: 'cash',
    note: 'Arisan RT Mei',
    created_at: '2025-05-25T14:00:00Z',
    is_adjustment_event: false,
  },
  // Adjustment event — shows the immutable ledger correction pattern
  {
    id: 'tx-011',
    type: 'expense',
    amount: 50_000,
    wallet_id: 'wlt-001',
    wallet_name: 'Tunai',
    category_id: 'cat-007',
    category_name: 'Pendidikan',
    payment_method: 'cash',
    note: 'Beli buku [ADJ: kategori dikoreksi dari Belanja]',
    created_at: '2025-05-24T16:00:00Z',
    updated_at: '2025-05-25T08:30:00Z',
    is_adjustment_event: true,
  },
  {
    id: 'tx-012',
    type: 'expense',
    amount: 240_000,
    wallet_id: 'wlt-002',
    wallet_name: 'BCA Tabungan',
    category_id: 'cat-009',
    category_name: 'Rumah & Perabot',
    payment_method: 'transfer',
    note: 'Peralatan dapur Tokopedia',
    created_at: '2025-05-23T15:00:00Z',
    is_adjustment_event: false,
  },
  {
    id: 'tx-013',
    type: 'expense',
    amount: 347_000,
    wallet_id: 'wlt-002',
    wallet_name: 'BCA Tabungan',
    category_id: 'cat-003',
    category_name: 'Belanja',
    payment_method: 'credit_card',
    note: 'Groceries bulanan — Ranch Market',
    created_at: '2025-05-22T12:00:00Z',
    is_adjustment_event: false,
  },
  {
    id: 'tx-014',
    type: 'expense',
    amount: 385_000,
    wallet_id: 'wlt-003',
    wallet_name: 'GoPay',
    category_id: 'cat-002',
    category_name: 'Transportasi',
    payment_method: 'debit_card',
    note: 'Grab seminggu',
    created_at: '2025-05-21T10:00:00Z',
    is_adjustment_event: false,
  },
  {
    id: 'tx-015',
    type: 'expense',
    amount: 800_000,
    wallet_id: 'wlt-002',
    wallet_name: 'BCA Tabungan',
    category_id: 'cat-001',
    category_name: 'Makanan & Minuman',
    payment_method: 'debit_card',
    note: 'Groceries mingguan supermarket',
    created_at: '2025-05-20T11:00:00Z',
    is_adjustment_event: false,
  },
];

export const MOCK_WALLET_BOOTSTRAP: WalletBootstrapResponse = {
  wallets: MOCK_WALLETS,
  category_limits: MOCK_CATEGORIES,
  recent_transactions: MOCK_TRANSACTIONS,
  pagination: {
    page: 1,
    limit: 20,
    total_items: 47,
    total_pages: 3,
  },
  active_filters: {
    sort: 'newest',
  },
  feature_unlocks: {
    can_create_wallet: false,   // Level 1: capped at 3
    can_create_category: false, // Level 1: capped at 10
    max_wallets: 3,
    max_categories: 10,
    analytics_unlocked: false,  // Unlocks at Level 3
  },
};

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
  /** True once the bootstrap payload has been loaded (real or mock). */
  isBootstrapped: boolean;

  // Filter state ─────────────────────────────────────────────────────────────
  filterState: FilterState;

  // UI state ─────────────────────────────────────────────────────────────────
  ui: WalletUIState;

  // Loading flags ────────────────────────────────────────────────────────────
  loading: LoadingState;

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  /**
   * Hydrates the store from a WalletBootstrapResponse.
   * Called once on page mount after the real API responds.
   */
  hydrate: (data: WalletBootstrapResponse) => void;

  /**
   * Loads MOCK_WALLET_BOOTSTRAP into the store.
   * Used during local development in place of a real API call.
   * Remove the call in WalletShell when switching to real data.
   */
  hydrateMock: () => void;

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

  // ── Wallet mutations ──────────────────────────────────────────────────────

  addWallet: (wallet: Wallet) => void;
  updateWallet: (id: string, patch: Partial<Wallet>) => void;
  removeWallet: (id: string) => void;

  // ── Category mutations ────────────────────────────────────────────────────

  setCategories: (categories: Category[]) => void;

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

  // ── Error / loading ───────────────────────────────────────────────────────

  setGlobalError: (message: string | null) => void;
  setLoading: (key: keyof LoadingState, value: boolean) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default slices
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_UI: WalletUIState = {
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
};

const DEFAULT_LOADING: LoadingState = {
  bootstrap: false,
  transactions: false,
  categories: false,
  mutation: false,
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
            isBootstrapped: true,
          },
          false,
          'wallet/hydrate',
        ),

      hydrateMock: () => get().hydrate(MOCK_WALLET_BOOTSTRAP),

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
    filterState: { transaction_type, category_id, payment_method, search },
    transactions,
  } = s;

  return transactions.filter((t) => {
    if (selectedWalletId && t.wallet_id !== selectedWalletId) return false;
    if (transaction_type && t.type !== transaction_type) return false;
    if (category_id && t.category_id !== category_id) return false;
    if (payment_method && t.payment_method !== payment_method) return false;
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      const inNote = t.note?.toLowerCase().includes(q) ?? false;
      const inCategory = t.category_name?.toLowerCase().includes(q) ?? false;
      const inWallet = t.wallet_name.toLowerCase().includes(q);
      if (!inNote && !inCategory && !inWallet) return false;
    }
    return true;
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

'use client';

import { create } from 'zustand';
import type {
  BootstrapData,
  ModalType,
  Transaction,
} from '../types/dashboard.types';

// ─── Mock Bootstrap Data ────────────────────────────────────────────────────────
// Mirrors the shape of GET /api/v1/me/bootstrap.
// Swap this out with real server data once the API is wired up.

const now = new Date();
const h = (hours: number) =>
  new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'txn-001',
    wallet_id: 'w-001',
    category_id: 'cat-003',
    category_name: 'Food & Drinks',
    wallet_name: 'Daily Wallet',
    type: 'expense',
    amount: 45_000,
    note: 'GoFood order',
    logged_at: h(2),
  },
  {
    id: 'txn-002',
    wallet_id: 'w-001',
    category_id: 'cat-005',
    category_name: 'Groceries',
    wallet_name: 'Daily Wallet',
    type: 'expense',
    amount: 35_000,
    note: 'Indomaret',
    logged_at: h(4),
  },
  {
    id: 'txn-003',
    wallet_id: 'w-002',
    category_id: 'cat-010',
    category_name: 'Side Income',
    wallet_name: 'Savings',
    type: 'income',
    amount: 500_000,
    note: 'Freelance payment',
    logged_at: h(26),
  },
  {
    id: 'txn-004',
    wallet_id: 'w-001',
    category_id: 'cat-006',
    category_name: 'Transport',
    wallet_name: 'Daily Wallet',
    type: 'expense',
    amount: 28_000,
    note: 'Grab',
    logged_at: h(30),
  },
];

export const MOCK_BOOTSTRAP: BootstrapData = {
  profile: {
    id: 'usr-abc123',
    username: 'pi',
    avatar_class: 'Sentinel',
    level: 4,
    hp: 72,
    xp: 1_450,
    gold: 320,
    shield: 15,
    setup_status: 'complete',
    active_theme: 'clear-night',
    current_region_id: 'region-northern-plains',
  },

  player_state: {
    hp: 72,
    hp_max: 100,
    xp: 1_450,
    xp_to_next_level: 1_600,
    xp_progress_percent: 79,
    gold: 320,
    shield: 15,
    standby_tokens: 5,
    standby_active: false,
  },

  daily_status: {
    daily_budget: 85_000,
    spent_today: 32_500,
    remaining_budget: 52_500,
    budget_percent_used: 38,
    streak_count: 7,
    zero_spend_marked: false,
    standby_active: false,
    last_transaction_at: h(2),
    ghost_warning: false,
    ghost_penalty_active: false,
    baseline_set: true,
    tasks_completed: 2,
    tasks_total: 3,
  },

  wallets: [
    { id: 'w-001', name: 'Daily Wallet', icon: 'wallet', balance: 450_000 },
    { id: 'w-002', name: 'Savings', icon: 'piggy-bank', balance: 2_100_000 },
    { id: 'w-003', name: 'Emergency Fund', icon: 'shield', balance: 5_000_000 },
  ],

  categories: [
    { id: 'cat-001', name: 'Salary', category_group: 'income' },
    { id: 'cat-002', name: 'Freelance', category_group: 'income' },
    { id: 'cat-003', name: 'Food & Drinks', category_group: 'expense' },
    { id: 'cat-004', name: 'Transport', category_group: 'expense' },
    { id: 'cat-005', name: 'Groceries', category_group: 'expense' },
    { id: 'cat-006', name: 'Utilities', category_group: 'expense' },
    { id: 'cat-007', name: 'Health', category_group: 'expense' },
    { id: 'cat-008', name: 'Entertainment', category_group: 'expense' },
    { id: 'cat-009', name: 'Education', category_group: 'expense' },
    { id: 'cat-010', name: 'Side Income', category_group: 'income' },
  ],

  tasks: [
    {
      id: 'tsk-001',
      title: 'Review food spending',
      objective_type: 'review_category',
      reward_xp: 20,
      reward_gold: 5,
      narrative_text: 'Audit your food category before midnight.',
      repeat_type: 'daily',
      completed: true,
      is_template: true,
    },
    {
      id: 'tsk-002',
      title: 'Log all transactions',
      objective_type: 'log_transactions',
      reward_xp: 30,
      reward_gold: 8,
      narrative_text: 'Keep your ledger current today.',
      repeat_type: 'daily',
      completed: true,
      is_template: true,
    },
    {
      id: 'tsk-003',
      title: 'Savings check',
      objective_type: 'review_savings',
      reward_xp: 25,
      reward_gold: 6,
      narrative_text: 'Verify your savings target is on track.',
      repeat_type: 'daily',
      completed: false,
      is_template: true,
    },
  ],

  active_region: {
    id: 'region-northern-plains',
    name: 'The Northern Plains',
    description: 'A stable frontier of measured growth.',
    progress: 28,
    asset_key: null,
  },

  active_challenge: {
    id: 'chal-q2-2025',
    type: 'quarterly_review',
    status: 'active',
    title: 'Quarterly Review: Debt Ambush',
    description:
      'Review your current liabilities and financial progress before the next checkpoint.',
    days_remaining: 5,
    asset_key: null,
  },

  recent_transactions: MOCK_TRANSACTIONS,

  notifications: {
    unread_count: 1,
    items: [
      {
        id: 'notif-001',
        category: 'SYSTEM',
        title: 'Ghost Penalty Warning',
        message: 'You have not logged any transactions recently. A ghost penalty may be applied soon.',
        severity: 'WARNING',
        read: false,
        created_at: h(1),
      }
    ],
  },

  feature_unlocks: {
    analytics: false,
    unlimited_wallets: true,
    unlimited_categories: true,
    custom_tasks: true,
    icon_customization: true,
  },
};

// ─── Store Shape ────────────────────────────────────────────────────────────────

interface DashboardStore {
  // Data
  data: BootstrapData;
  isLoading: boolean;
  error: string | null;

  // UI
  activeModal: ModalType;

  // Data actions
  setData: (data: BootstrapData) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Modal actions
  openModal: (modal: Exclude<ModalType, null>) => void;
  closeModal: () => void;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useDashboardStore = create<DashboardStore>()((set) => ({
  data: MOCK_BOOTSTRAP,
  isLoading: false,
  error: null,
  activeModal: null,

  setData: (data) => set({ data }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
}));

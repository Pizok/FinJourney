// ─── Primitives ────────────────────────────────────────────────────────────────

export type AvatarClass = 'Sentinel' | 'Vanguard' | 'Phantom' | 'Oracle';
export type SetupStatus = 'onboarding' | 'setup' | 'complete';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type TaskRepeatType = 'daily' | 'weekly' | 'monthly' | 'once';
export type ChallengeStatus = 'active' | 'idle';
export type ChallengeType =
  | 'quarterly_review'
  | 'adventure'
  | 'debt_raid'
  | 'savings_expedition'
  | 'survival_challenge';

export type ModalType =
  | 'welcome'
  | 'tutorial'
  | 'danger'
  | 'addTransaction'
  | 'notification'
  | 'zeroSpend'
  | 'unlock'
  | 'audit'
  | null;

// ─── Domain Models ──────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  username: string;
  avatar_class: AvatarClass;
  level: number;
  hp: number;
  xp: number;
  gold: number;
  shield: number;
  setup_status: SetupStatus;
  active_theme: string;
  current_region_id: string | null;
}

export interface PlayerState {
  hp: number;
  hp_max: number;
  xp: number;
  xp_to_next_level: number;
  xp_progress_percent: number;
  gold: number;
  shield: number;
  standby_tokens: number;
  standby_active: boolean;
}

export interface DailyStatus {
  daily_budget: number;
  spent_today: number;
  remaining_budget: number;
  budget_percent_used: number;
  streak_count: number;
  zero_spend_marked: boolean;
  standby_active: boolean;
  last_transaction_at: string | null;
  ghost_warning: boolean;
  ghost_penalty_active: boolean;
  baseline_set: boolean;
  tasks_completed: number;
  tasks_total: number;
}

export interface Wallet {
  id: string;
  name: string;
  icon: string;
  balance: number;
}

export interface Category {
  id: string;
  name: string;
  category_group: 'expense' | 'income';
  icon?: string;
}

export interface Task {
  id: string;
  title: string;
  objective_type: string;
  reward_xp: number;
  reward_gold: number;
  narrative_text: string;
  repeat_type: TaskRepeatType;
  completed: boolean;
  is_template: boolean;
}

export interface ActiveRegion {
  id: string;
  name: string;
  description: string;
  progress: number;
  asset_key: string | null;
}

export interface ActiveChallenge {
  id: string;
  type: ChallengeType;
  status: ChallengeStatus;
  title: string;
  description: string;
  days_remaining: number | null;
  asset_key: string | null;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  category_id: string;
  category_name: string;
  wallet_name: string;
  type: TransactionType;
  amount: number;
  note: string;
  logged_at: string;
}

export interface FeatureUnlocks {
  analytics: boolean;
  unlimited_wallets: boolean;
  unlimited_categories: boolean;
  custom_tasks: boolean;
  icon_customization: boolean;
}

export interface PendingUnlock {
  id: string;
  level_reached: number;
  feature_key: string;
}

export interface NotificationItem {
  id: string;
  category: string;
  title: string;
  message: string;
  severity: string;
  read: boolean;
  action_type?: string | null;
  action_payload?: Record<string, any> | null;
  created_at: string;
}

export interface NotificationsResponse {
  unread_count: number;
  items: NotificationItem[];
}

// ─── Bootstrap Payload ─────────────────────────────────────────────────────────

export interface BootstrapData {
  profile: Profile;
  player_state: PlayerState;
  daily_status: DailyStatus;
  wallets: Wallet[];
  categories: Category[];
  tasks: Task[];
  active_region: ActiveRegion | null;
  active_challenge: ActiveChallenge | null;
  recent_transactions: Transaction[];
  feature_unlocks: FeatureUnlocks;
  pending_unlocks: PendingUnlock[];
  notifications: NotificationsResponse;
}

// ─── Form Payloads ─────────────────────────────────────────────────────────────

export interface AddTransactionPayload {
  wallet_id: string;
  category_id: string;
  type: TransactionType;
  amount: string;
  note: string;
}

export interface AddTransactionErrors {
  amount?: string;
  wallet_id?: string;
  category_id?: string;
  general?: string;
}

// ─── UI State ──────────────────────────────────────────────────────────────────

export interface DashboardUIState {
  activeModal: ModalType;
  sidebarCollapsed: boolean;
}

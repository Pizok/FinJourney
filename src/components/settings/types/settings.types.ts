// ─── settings.types.ts ────────────────────────────────────────────────────────
// All types derived from GET /api/v1/settings hydration contract.
// See: settings_data_contract.md
// ─────────────────────────────────────────────────────────────────────────────

// ── Profile ──────────────────────────────────────────────────────────────────

export interface ProfileSettings {
  avatar_key: string
  avatar_url: string
  username: string
  /** Read-only. Managed by the auth provider. */
  email: string
  timezone: string
  /** ISO timestamp. Null when no active lock. */
  timezone_locked_until: string | null
}

// ── Financials ───────────────────────────────────────────────────────────────

export interface FixedCostsSummary {
  total: number
  active_loans: number
  fixed_categories: number
}

export interface FinancialSettings {
  expected_monthly_income: number
  monthly_savings_target: number
  /** Derived from active loans + fixed categories. Read-only on Settings page. */
  fixed_costs: FixedCostsSummary
  /** Computed by backend: (income - fixed_costs - savings) / 30 */
  projected_safe_daily_budget: number
}

// ── Progression ──────────────────────────────────────────────────────────────

export type PathId = 'sentinel' | 'phantom' | 'vanguard'

export interface ActivePath {
  id: PathId
  name: string
  description: string
}

export interface ProgressionSettings {
  active_path: ActivePath
  cooldown_active: boolean
  /** Remaining days if cooldown is active. 0 when inactive. */
  cooldown_days_remaining: number
}

// ── Preferences ──────────────────────────────────────────────────────────────

export type ThemePreference = 'light' | 'dark' | 'system'

export interface PreferencesSettings {
  theme: ThemePreference
  /** Disables CSS animations and transitions across the app. */
  reduced_motion: boolean
}

// ── Notifications ────────────────────────────────────────────────────────────

export interface NotificationSettings {
  /** Evening reminder to log transactions (20:00 local timezone). */
  daily_reminder: boolean
  /** Alerts when Debt Ambush fires or HP drops critical. */
  hazard_alerts: boolean
  /** Positive event alerts: Level Ups, Quarter completions. */
  achievement_notifications: boolean
}

// ── Root Payload ─────────────────────────────────────────────────────────────

/** Full hydration response from GET /api/v1/settings */
export interface Settings {
  profile: ProfileSettings
  financials: FinancialSettings
  progression: ProgressionSettings
  preferences: PreferencesSettings
  notifications: NotificationSettings
}

// ── Mutation Payloads (PATCH) ─────────────────────────────────────────────────

/** PATCH /api/v1/settings/profile */
export interface ProfileSettingsUpdate {
  username: string
  timezone: string
  avatar_key: string
}

/** PATCH /api/v1/settings/financials */
export interface FinancialSettingsUpdate {
  expected_monthly_income: number
  monthly_savings_target: number
}

/** PATCH /api/v1/settings/preferences */
export type PreferencesUpdate = PreferencesSettings

/** PATCH /api/v1/settings/notifications */
export type NotificationsUpdate = NotificationSettings

// ── Fixed Costs Breakdown (Lazy Modal) ───────────────────────────────────────

export interface FixedCostItem {
  name: string
  amount: number
}

/** GET /api/v1/settings/fixed-costs — lazy-loaded when opening breakdown modal */
export interface FixedCostsBreakdown {
  loans: FixedCostItem[]
  fixed_categories: FixedCostItem[]
  total: number
}

// ── Path Change ───────────────────────────────────────────────────────────────

/** POST /api/v1/settings/path/change */
export interface PathChangeRequest {
  path_id: PathId
}

export interface PathChangeResponse {
  success: boolean
  cooldown_days: number
  active_path: Pick<ActivePath, 'id' | 'name'>
}


// ── Standard API Envelope ─────────────────────────────────────────────────────

export interface ApiSuccess<T = Record<string, unknown>> {
  success: true
  data: T
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
  }
}

export type ApiResponse<T = Record<string, unknown>> = ApiSuccess<T> | ApiError

// ── Navigation ────────────────────────────────────────────────────────────────

/** Sidebar section identifiers — used for scroll-spy and anchor links */
export type SettingsSectionId =
  | 'profile'
  | 'financials'
  | 'progression'
  | 'preferences'
  | 'notifications'

export interface SettingsNavItem {
  id: SettingsSectionId
  label: string
  description: string
}

// ── Store Shape ───────────────────────────────────────────────────────────────

/** Tracks the current dirty delta for each section independently */
export interface DirtyFlags {
  profile: boolean
  financials: boolean
  preferences: boolean
  notifications: boolean
}

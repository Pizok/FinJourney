// ─── settingsStore.ts ─────────────────────────────────────────────────────────
// Zustand store for the Settings page.
//
// Responsibilities:
//   • Holds the canonical "saved" server state (savedSettings)
//   • Holds the local draft under edit (currentSettings)
//   • Tracks isDirty by deep-comparing the two
//   • Provides per-section update actions
//   • Exposes discard / markSaved lifecycle hooks
//
// TanStack Query owns server communication.
// This store owns UI edit state and dirty tracking only.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import type {
  Settings,
  ProfileSettingsUpdate,
  FinancialSettingsUpdate,
  PreferencesUpdate,
  NotificationsUpdate,
  SettingsSectionId,
} from '../types/settings.types'

// ─── Mock Data ────────────────────────────────────────────────────────────────
// Used as the initial store state during UI development.
// Replace with real API data by calling store.hydrate(apiResponse).

export const MOCK_SETTINGS: Settings = {
  profile: {
    avatar_key: 'Roan',
    avatar_url: '/avatars/default.png',
    username: 'Pi',
    email: 'user@email.com',
    timezone: 'Asia/Jakarta',
    timezone_locked_until: null,
    primary_payday: 25,
  },
  financials: {
    expected_monthly_income: 10_000_000,
    monthly_savings_target: 2_000_000,
    fixed_costs: {
      total: 4_360_000,
      active_loans: 2,
      fixed_categories: 4,
    },
    projected_safe_daily_budget: 120_000,
  },
  progression: {
    active_path: {
      id: 'sentinel',
      name: 'Sentinel',
      description:
        'Defensive focus. Boosts shield effectiveness and rewards emergency savings.',
    },
    cooldown_active: true,
    cooldown_days_remaining: 124,
  },
  preferences: {
    theme: 'system',
    reduced_motion: false,
    privacy_mode: false,
  },
  notifications: {
    daily_reminder: true,
    hazard_alerts: true,
    achievement_notifications: true,
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Deep equality via JSON serialisation. Sufficient for flat-to-shallow structures. */
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * Derives the projected safe daily budget from current inputs.
 * Used for immediate UI feedback ONLY — backend value is authoritative on save.
 *
 * Formula (from logic.md): (income - fixed_costs - savings) / 30
 */
export function deriveProjectedBudget(
  income: number,
  fixedCosts: number,
  savings: number,
): number {
  const result = (income - fixedCosts - savings) / 30
  return Math.max(0, Math.round(result))
}

/**
 * Validates that the savings target is not mathematically impossible.
 * Returns an error message string when invalid, or null when valid.
 */
export function validateSavingsTarget(
  income: number,
  fixedCosts: number,
  savingsTarget: number,
): string | null {
  const available = income - fixedCosts
  if (savingsTarget > available) {
    return `Invalid target. Available after fixed costs: Rp ${available.toLocaleString('id-ID')}. Your savings target: Rp ${savingsTarget.toLocaleString('id-ID')}.`
  }
  return null
}

// ─── Store Interface ──────────────────────────────────────────────────────────

interface SettingsState {
  // ── Server State ────────────────────────────────────────────────────────────
  /** The last known persisted state. Source of truth for "discard". */
  savedSettings: Settings

  // ── Draft State ─────────────────────────────────────────────────────────────
  /** The user's current (potentially unsaved) edits. */
  currentSettings: Settings

  // ── Derived ─────────────────────────────────────────────────────────────────
  /** True when currentSettings differs from savedSettings. */
  isDirty: boolean

  /** True while a PATCH mutation is in-flight. Used to disable buttons. */
  isSaving: boolean

  /** The section the user is currently scrolled to (used by sidebar). */
  activeSection: SettingsSectionId

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Called after GET /api/v1/settings resolves.
   * Resets both saved and current state to the server payload.
   */
  hydrate: (data: Settings) => void

  // ── Field Update Actions ─────────────────────────────────────────────────────
  // Each action merges a partial patch into currentSettings and recomputes isDirty.

  updateProfile: (patch: Partial<ProfileSettingsUpdate>) => void

  updateFinancials: (patch: Partial<FinancialSettingsUpdate>) => void

  updatePreferences: (patch: Partial<PreferencesUpdate>) => void

  updateNotifications: (patch: Partial<NotificationsUpdate>) => void

  // ── Unsaved Changes Bar ──────────────────────────────────────────────────────

  /**
   * Reverts currentSettings to savedSettings.
   * Called by the Discard button in UnsavedChangesBar.
   */
  discard: () => void

  /**
   * Called after a successful PATCH response.
   * Updates savedSettings to the new canonical state and clears dirty flag.
   */
  markSaved: (data: Settings) => void

  /** Controls the saving spinner state. */
  setSaving: (val: boolean) => void

  // ── Navigation ───────────────────────────────────────────────────────────────

  setActiveSection: (section: SettingsSectionId) => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  savedSettings: MOCK_SETTINGS,
  currentSettings: clone(MOCK_SETTINGS),
  isDirty: false,
  isSaving: false,
  activeSection: 'profile',

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  hydrate: (data) => {
    set({
      savedSettings: data,
      currentSettings: clone(data),
      isDirty: false,
    })
  },

  // ── Profile ───────────────────────────────────────────────────────────────

  updateProfile: (patch) => {
    const current = get().currentSettings
    const updated: Settings = {
      ...current,
      profile: { ...current.profile, ...patch },
    }
    set({
      currentSettings: updated,
      isDirty: !deepEqual(updated, get().savedSettings),
    })
  },

  // ── Financials ────────────────────────────────────────────────────────────

  updateFinancials: (patch) => {
    const current = get().currentSettings
    const merged = { ...current.financials, ...patch }

    // Derive a local preview of projected_safe_daily_budget for immediate feedback.
    // The backend recalculates this authoritatively on PATCH.
    const projectedBudget = deriveProjectedBudget(
      merged.expected_monthly_income,
      merged.fixed_costs.total,
      merged.monthly_savings_target,
    )

    const updated: Settings = {
      ...current,
      financials: {
        ...merged,
        projected_safe_daily_budget: projectedBudget,
      },
    }

    set({
      currentSettings: updated,
      isDirty: !deepEqual(updated, get().savedSettings),
    })
  },

  // ── Preferences ───────────────────────────────────────────────────────────

  updatePreferences: (patch) => {
    const current = get().currentSettings
    const updated: Settings = {
      ...current,
      preferences: { ...current.preferences, ...patch },
    }
    set({
      currentSettings: updated,
      isDirty: !deepEqual(updated, get().savedSettings),
    })
  },

  // ── Notifications ─────────────────────────────────────────────────────────

  updateNotifications: (patch) => {
    const current = get().currentSettings
    const updated: Settings = {
      ...current,
      notifications: { ...current.notifications, ...patch },
    }
    set({
      currentSettings: updated,
      isDirty: !deepEqual(updated, get().savedSettings),
    })
  },

  // ── Unsaved Changes Bar ───────────────────────────────────────────────────

  discard: () => {
    const saved = get().savedSettings
    set({
      currentSettings: clone(saved),
      isDirty: false,
    })
  },

  markSaved: (data) => {
    set({
      savedSettings: data,
      currentSettings: clone(data),
      isDirty: false,
      isSaving: false,
    })
  },

  setSaving: (val) => set({ isSaving: val }),

  // ── Navigation ────────────────────────────────────────────────────────────

  setActiveSection: (section) => set({ activeSection: section }),
}))

// ─── Selectors ────────────────────────────────────────────────────────────────
// Memoised selectors for common read patterns. Import alongside the store.

/** Returns only the current profile settings draft. */
export const selectCurrentProfile = (s: SettingsState) => s.currentSettings.profile

/** Returns only the current financials draft. */
export const selectCurrentFinancials = (s: SettingsState) =>
  s.currentSettings.financials

/** Returns only the current preferences draft. */
export const selectCurrentPreferences = (s: SettingsState) =>
  s.currentSettings.preferences

/** Returns only the current notifications draft. */
export const selectCurrentNotifications = (s: SettingsState) =>
  s.currentSettings.notifications

/** Returns only the current progression settings (read-only on this page). */
export const selectCurrentProgression = (s: SettingsState) =>
  s.currentSettings.progression

/** True when the current savings target is mathematically invalid. */
export const selectSavingsValidationError = (s: SettingsState): string | null => {
  const { expected_monthly_income, monthly_savings_target, fixed_costs } =
    s.currentSettings.financials
  return validateSavingsTarget(
    expected_monthly_income,
    fixed_costs.total,
    monthly_savings_target,
  )
}

/**
 * True when ANY section currently has a validation error that must block
 * the global Save action — independent of isDirty.
 *
 * Consumed by UnsavedChangesBar to disable [Save Changes] even while the
 * form is dirty, per settings_prd.md §4.3 (Impossible Budget Validation):
 * "the [Save Changes] button is disabled."
 *
 * Currently checks only the financials savings/income/fixed-costs relationship.
 * Extend this with `||` as additional cross-field validations are introduced.
 */
export const selectHasBlockingValidationErrors = (s: SettingsState): boolean =>
  selectSavingsValidationError(s) !== null

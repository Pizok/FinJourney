// ─── SettingsShell.tsx ────────────────────────────────────────────────────────
// Top-level layout container for the Settings page.
//
// Desktop:  [DashboardSidebar] [scrollable content area flex-1]
// Mobile:   single scrollable column (sidebar hidden)
//
// The UnsavedChangesBar is rendered here (fixed position, outside scroll flow).
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetchClient } from '@/lib/apiClient.client'
import { toast } from 'sonner'
import { useSettingsStore } from '../store/settingsStore'
import { DashboardSidebar } from '../../dashboard/layout/DashboardSidebar'
import { SettingsSidebar } from './SettingsSidebar'
import { UnsavedChangesBar } from '../states/UnsavedChangesBar'

// ── Section placeholder — replaced by real cards in Part 2+ ──────────────────

function SectionPlaceholder({
  id,
  title,
  description,
}: {
  id: string
  title: string
  description: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="rounded-xl border border-tactical-border bg-canvas-surface p-8 scroll-mt-32"
    >
      <h2
        id={`${id}-heading`}
        className="font-display text-lg font-semibold text-pearl-text"
      >
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted-text">{description}</p>
      {/* Card content injected in subsequent implementation parts */}
    </section>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────

interface SettingsShellProps {
  /** Optional override for the content area. Used in tests and Storybook. */
  children?: ReactNode
}

export function SettingsShell({ children }: SettingsShellProps) {
  const queryClient = useQueryClient()
  const currentSettings = useSettingsStore(s => s.currentSettings)
  const savedSettings = useSettingsStore(s => s.savedSettings)
  const markSaved = useSettingsStore(s => s.markSaved)
  const isDirty = useSettingsStore(s => s.isDirty)
  const setSaving = useSettingsStore(s => s.setSaving)

  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1. Check what changed and only PATCH those sections.
      const promises = []

      // Profile
      if (JSON.stringify(currentSettings.profile) !== JSON.stringify(savedSettings.profile)) {
        promises.push(apiFetchClient('settings/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentSettings.profile)
        }))
      }

      // Financials
      if (JSON.stringify(currentSettings.financials) !== JSON.stringify(savedSettings.financials)) {
        promises.push(apiFetchClient('settings/financials', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentSettings.financials)
        }))
      }

      // Preferences
      if (JSON.stringify(currentSettings.preferences) !== JSON.stringify(savedSettings.preferences)) {
        promises.push(apiFetchClient('settings/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentSettings.preferences)
        }))
      }

      // Notifications
      if (JSON.stringify(currentSettings.notifications) !== JSON.stringify(savedSettings.notifications)) {
        promises.push(apiFetchClient('settings/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentSettings.notifications)
        }))
      }

      if (promises.length > 0) {
        await Promise.all(promises)
      }
      
      // Return fresh data or just the current draft
      return currentSettings
    },
    onSuccess: (data) => {
      markSaved(data)
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Settings saved successfully.')
    },
    onError: () => {
      toast.error('Failed to save settings. Please try again.')
    }
  })

  // Removed debounced auto-save effect to allow manual saving via UnsavedChangesBar

  return (
    <>
      <div className="flex h-screen bg-abyssal-slate">
        {/* Dashboard Navigation */}
        <DashboardSidebar />

        {/* ── Settings Content Area ────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-w-0 overflow-hidden">
          
          {/* ── Settings Inner Sidebar (Vertical) ──────────────────────────────── */}
          <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-[var(--color-tactical-border)] bg-[var(--color-abyssal-slate)] lg:block">
            <div className="p-8">
              <h1 className="mb-1 font-display text-2xl font-semibold text-[var(--color-pearl-text)]">
                Settings
              </h1>
              <p className="mb-8 text-sm text-[var(--color-muted-text)]">
                Account &amp; preferences
              </p>
              <SettingsSidebar />
            </div>
          </aside>

          {/* ── Scrollable Content Grid ──────────────────────────────────────── */}
          <main
            id="settings-content"
            className="flex-1 overflow-y-auto px-6 py-8 lg:px-10"
            aria-label="Settings sections"
          >
            {/* Mobile Header (Hidden on Desktop since Desktop has the Sidebar) */}
            <div className="mb-8 block lg:hidden">
              <h1 className="mb-1 font-display text-2xl font-semibold text-[var(--color-pearl-text)]">
                Settings
              </h1>
              <p className="mb-6 text-sm text-[var(--color-muted-text)]">
                Account &amp; preferences
              </p>
              <SettingsSidebar />
            </div>

            {children ?? (
              <div className="flex flex-col gap-6">
                <SectionPlaceholder
                  id="profile"
                  title="Profile & Account"
                  description="Manage your identity and timezone."
                />
                <SectionPlaceholder
                  id="progression"
                  title="Journey & Progression"
                  description="View your active path and manage game progression settings."
                />
                <SectionPlaceholder
                  id="preferences"
                  title="Preferences & Experience"
                  description="Theme and motion controls."
                />
                <SectionPlaceholder
                  id="notifications"
                  title="Notifications & Alerts"
                  description="Control when and how FinJourney reaches you."
                />

                {/* Bottom padding so UnsavedChangesBar never overlaps last card */}
                <div className="h-24" aria-hidden="true" />
              </div>
            )}
          </main>
        </div>
      </div>
      <UnsavedChangesBar onSave={() => saveMutation.mutateAsync().then(() => {})} />
    </>
  )
}

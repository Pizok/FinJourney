// ─── app/(minimal)/settings/page.tsx ─────────────────────────────────────────
// Settings page entry point.
//
// Architecture:
//   • TanStack Query owns the server round-trip (GET /api/v1/settings)
//   • On success, the Zustand store is hydrated via store.hydrate(data)
//   • Loading → SettingsSkeleton
//   • Error   → SettingsErrorState
//   • Success → SettingsShell (with section cards as children)
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useSettingsStore } from '@/components/settings/store/settingsStore'
import { SettingsShell } from '@/components/settings/layout/SettingsShell'
import {
  SettingsSkeleton,
  SettingsErrorState,
} from '@/components/settings/states/SettingsSkeleton'
import { ProfileCard } from '@/components/settings/profile/ProfileCard'
import { JourneyProgressionCard } from '@/components/settings/progression/JourneyProgressionCard'
import { PreferencesCard } from '@/components/settings/preferences/PreferencesCard'
import { NotificationSettingsCard } from '@/components/settings/notifications/NotificationSettingsCard'
import type { Settings } from '@/components/settings/types/settings.types'

import { apiFetchClient } from '@/lib/apiClient.client'

// ─── Data Fetcher ─────────────────────────────────────────────────────────────

async function fetchSettings(): Promise<Settings> {
  // Uses apiFetchClient to ensure the Supabase JWT is injected as a Bearer token.
  return await apiFetchClient('settings') as Settings
}

// ─── Query Key ────────────────────────────────────────────────────────────────

export const SETTINGS_QUERY_KEY = ['settings'] as const

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const hydrate = useSettingsStore((s) => s.hydrate)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchSettings,
    staleTime: 300_000, // 5 min — matches settings_data_contract.md
    refetchOnWindowFocus: true,
  })

  // Hydrate the Zustand store whenever fresh server data arrives.
  useEffect(() => {
    if (data) {
      hydrate(data)
    }
  }, [data, hydrate])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-abyssal-slate">
        <SettingsSkeleton />
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="min-h-screen bg-abyssal-slate">
        <SettingsErrorState
          message={
            error instanceof Error
              ? error.message
              : 'Something went wrong while loading your settings.'
          }
          onRetry={refetch}
        />
      </div>
    )
  }

  // ── Success ────────────────────────────────────────────────────────────────
  // SettingsShell renders the sidebar + content layout.
  // All five section cards are passed as children, replacing the placeholder scaffolds.
  return (
    <SettingsShell>
      <div className="flex flex-col gap-6">
        <ProfileCard />
        <JourneyProgressionCard />
        <PreferencesCard />
        <NotificationSettingsCard />

        {/* Bottom padding so UnsavedChangesBar never overlaps last card */}
        <div className="h-24" aria-hidden="true" />
      </div>
    </SettingsShell>
  )
}

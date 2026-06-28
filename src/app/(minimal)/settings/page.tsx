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

import { createClient } from '@/lib/supabase.client'

// ─── Data Fetcher ─────────────────────────────────────────────────────────────

async function fetchSettings(): Promise<Settings> {
  const raw = await apiFetchClient<any>('settings')
  
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email || ''

  const pathKey = (raw.active_path?.path_key || 'sentinel').toLowerCase()
  const safePathId = ['sentinel', 'phantom', 'vanguard'].includes(pathKey) ? pathKey : 'sentinel'
  
  const cooldownUntil = raw.active_path?.cooldown_until ? new Date(raw.active_path.cooldown_until) : null
  const now = new Date()
  const cooldownActive = !!cooldownUntil && cooldownUntil > now
  const cooldownDays = cooldownActive ? Math.ceil((cooldownUntil!.getTime() - now.getTime()) / (1000 * 3600 * 24)) : 0

  return {
    profile: {
      ...raw.profile,
      email
    },
    financials: raw.financials,
    preferences: raw.preferences,
    notifications: raw.notifications,
    progression: {
      active_path: {
        id: safePathId as any,
        name: raw.active_path?.display_name || 'Sentinel',
        description: ''
      },
      cooldown_active: cooldownActive,
      cooldown_days_remaining: cooldownDays
    }
  } as Settings
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
      <SettingsShell>
        <SettingsSkeleton />
      </SettingsShell>
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
        {/* <NotificationSettingsCard /> Hidden per user request */}

        {/* Bottom padding so UnsavedChangesBar never overlaps last card */}
        <div className="h-24" aria-hidden="true" />
      </div>
    </SettingsShell>
  )
}

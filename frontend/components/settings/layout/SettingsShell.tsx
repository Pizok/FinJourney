// ─── SettingsShell.tsx ────────────────────────────────────────────────────────
// Top-level layout container for the Settings page.
//
// Desktop:  [SettingsSidebar 240px] [scrollable content area flex-1]
// Mobile:   single scrollable column (sidebar hidden)
//
// The UnsavedChangesBar is rendered here (fixed position, outside scroll flow).
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import { type ReactNode } from 'react'
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
      className="rounded-xl border border-tactical-border bg-canvas-surface p-8 scroll-mt-8"
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
  return (
    <>
      {/*
        Outer wrapper: full-height, abyssal-slate background.
        Provides the base surface behind the max-width container.
      */}
      <div className="min-h-screen bg-abyssal-slate">
        {/* ── Page Header ────────────────────────────────────────────────── */}
        <header className="border-b border-tactical-border bg-abyssal-slate">
          <div className="mx-auto max-w-[1440px] px-6 py-6 lg:px-10">
            <div className="flex items-baseline gap-3">
              <h1 className="font-display text-2xl font-semibold text-pearl-text">
                Settings
              </h1>
              <span className="text-sm text-muted-text">
                Account, finances &amp; preferences
              </span>
            </div>
          </div>
        </header>

        {/* ── Content Grid ───────────────────────────────────────────────── */}
        <div className="mx-auto max-w-[1440px] px-6 py-8 lg:px-10">
          <div className="flex gap-10 lg:gap-12">

            {/* ── Sidebar — desktop only ──────────────────────────────────── */}
            <div className="hidden lg:block lg:shrink-0">
              <SettingsSidebar />
            </div>

            {/* ── Main content column ─────────────────────────────────────── */}
            <main
              id="settings-content"
              className="min-w-0 flex-1"
              aria-label="Settings sections"
            >
              {children ?? (
                /*
                  Default section scaffolding.
                  These empty cards serve as scroll targets for the sidebar
                  and will be replaced with real card components in Part 2+.
                */
                <div className="flex flex-col gap-6">
                  <SectionPlaceholder
                    id="profile"
                    title="Profile & Account"
                    description="Manage your identity, timezone, and payday."
                  />
                  <SectionPlaceholder
                    id="financials"
                    title="Financial Assumptions"
                    description="Set the income and savings targets that power your Daily Budget."
                  />
                  <SectionPlaceholder
                    id="progression"
                    title="Journey & Progression"
                    description="View your active path and manage game progression settings."
                  />
                  <SectionPlaceholder
                    id="preferences"
                    title="Preferences & Experience"
                    description="Theme, motion, and privacy controls."
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
      </div>

      {/*
        UnsavedChangesBar lives outside the scroll container so it floats
        above all content when dirty state is active.
      */}
      <UnsavedChangesBar />
    </>
  )
}

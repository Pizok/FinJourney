// ─── SettingsSidebar.tsx ──────────────────────────────────────────────────────
// Sticky left-hand navigation for the Settings page.
//
// Behaviour:
//   • Clicking an item smooth-scrolls to its section
//   • IntersectionObserver tracks the active section as the user scrolls
//   • Active state uses muted-emerald text + a 1px left indicator line
//   • No scroll-triggered animations that could distract (DESIGN.md)
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import { useEffect, useRef } from 'react'
import {
  User,
  BarChart2,
  Shield,
  SlidersHorizontal,
  Bell,
} from 'lucide-react'
import { useSettingsStore } from '../store/settingsStore'
import type { SettingsSectionId, SettingsNavItem } from '../types/settings.types'

// ─── Nav Item Definitions ─────────────────────────────────────────────────────

const NAV_ITEMS: SettingsNavItem[] = [
  {
    id: 'profile',
    label: 'Profile & Account',
    description: 'Identity, timezone, payday',
  },
  {
    id: 'financials',
    label: 'Financial Assumptions',
    description: 'Income, savings, daily budget',
  },
  {
    id: 'progression',
    label: 'Journey & Progression',
    description: 'Path, cooldown, reset',
  },
  {
    id: 'preferences',
    label: 'Preferences',
    description: 'Theme, motion, privacy',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Reminders and alerts',
  },
]

const SECTION_ICONS: Record<SettingsSectionId, React.ElementType> = {
  profile: User,
  financials: BarChart2,
  progression: Shield,
  preferences: SlidersHorizontal,
  notifications: Bell,
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SettingsSidebar() {
  const activeSection = useSettingsStore((s) => s.activeSection)
  const setActiveSection = useSettingsStore((s) => s.setActiveSection)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // ── Scroll-spy via IntersectionObserver ──────────────────────────────────

  useEffect(() => {
    const sectionIds = NAV_ITEMS.map((item) => item.id)

    // Track the topmost visible section
    const visibleSections = new Map<string, number>()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleSections.set(entry.target.id, entry.boundingClientRect.top)
          } else {
            visibleSections.delete(entry.target.id)
          }
        })

        // Activate the section closest to the top of the viewport
        if (visibleSections.size > 0) {
          const topmost = [...visibleSections.entries()].reduce((a, b) =>
            Math.abs(a[1]) < Math.abs(b[1]) ? a : b,
          )
          setActiveSection(topmost[0] as SettingsSectionId)
        }
      },
      {
        rootMargin: '-10% 0px -60% 0px',
        threshold: 0,
      },
    )

    sectionIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observerRef.current?.observe(el)
    })

    return () => {
      observerRef.current?.disconnect()
    }
  }, [setActiveSection])

  // ── Click handler ─────────────────────────────────────────────────────────

  function handleNavClick(
    e: React.MouseEvent<HTMLAnchorElement>,
    id: SettingsSectionId,
  ) {
    e.preventDefault()
    const target = document.getElementById(id)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveSection(id)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <aside className="w-[220px]" aria-label="Settings navigation">
      {/* Sticky wrapper — aligns to the top of the page content area */}
      <nav className="sticky top-8" aria-label="Settings sections">
        <p className="mb-4 px-3 font-display text-[11px] font-semibold uppercase tracking-widest text-muted-text">
          Sections
        </p>

        <ul className="flex flex-col gap-0.5" role="list">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id
            const Icon = SECTION_ICONS[item.id]

            return (
              <li key={item.id} role="listitem">
                <a
                  href={`#${item.id}`}
                  onClick={(e) => handleNavClick(e, item.id)}
                  aria-current={isActive ? 'location' : undefined}
                  className={[
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2.5',
                    'transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-emerald focus-visible:ring-offset-2 focus-visible:ring-offset-abyssal-slate',
                    isActive
                      ? 'bg-canvas-surface text-pearl-text'
                      : 'text-muted-text hover:bg-canvas-surface/60 hover:text-pearl-text',
                  ].join(' ')}
                >
                  {/*
                    Active indicator — a single 2px left edge using an
                    absolutely-positioned element. Avoids the banned
                    "side-stripe border" pattern by being 2px (hairline accent,
                    not a thick stripe) and limited to the active state only.
                  */}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-muted-emerald"
                    />
                  )}

                  {/* Icon */}
                  <Icon
                    className={[
                      'shrink-0 transition-colors duration-150',
                      isActive
                        ? 'text-muted-emerald'
                        : 'text-muted-text group-hover:text-pearl-text',
                    ].join(' ')}
                    size={15}
                    strokeWidth={2}
                    aria-hidden="true"
                  />

                  {/* Label */}
                  <span className="font-sans text-sm font-medium leading-none">
                    {item.label}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}

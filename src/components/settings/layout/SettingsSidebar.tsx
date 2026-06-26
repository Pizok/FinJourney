'use client'

import { useEffect, useRef } from 'react'
import {
  User,
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
    description: 'Identity and timezone',
  },
  {
    id: 'progression',
    label: 'Journey & Progression',
    description: 'Path, cooldown, reset',
  },
  {
    id: 'preferences',
    label: 'Preferences',
    description: 'Theme and motion',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Reminders and alerts',
  },
]

const SECTION_ICONS: Record<string, React.ElementType> = {
  profile: User,
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
    <nav className="flex flex-col gap-2" aria-label="Settings sections">
      {NAV_ITEMS.map((item) => {
        const isActive = activeSection === item.id
        const Icon = SECTION_ICONS[item.id]

        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(e) => handleNavClick(e, item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150',
              isActive
                ? 'bg-muted-emerald/10 text-pearl-text'
                : 'bg-transparent text-muted-text hover:bg-tactical-border/30 hover:text-pearl-text',
            ].join(' ')}
          >
            <Icon
              className={[
                'shrink-0 transition-colors duration-150',
                isActive ? 'text-muted-emerald' : 'text-muted-text group-hover:text-pearl-text',
              ].join(' ')}
              size={18}
              strokeWidth={2}
              aria-hidden="true"
            />
            <div className="flex flex-col">
              <span className="font-sans text-sm font-medium leading-none">
                {item.label}
              </span>
              <span className="font-sans text-[11px] text-muted-text mt-1">
                {item.description}
              </span>
            </div>
          </a>
        )
      })}
    </nav>
  )
}


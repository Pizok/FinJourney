// ─── pathCatalog.ts ───────────────────────────────────────────────────────────
// Static frontend metadata for the three player paths.
//
// Why this lives in its own file:
//   The API only returns the *active* path id, name, and description.
//   Icon bindings, taglines, bonus copy, and accent colours are frontend-only
//   product content. Centralising them here avoids duplication between
//   JourneyProgressionCard (display) and ChangePathModal (selection).
//
// Import pattern:
//   import { PATH_CATALOG, PATH_LIST } from '../progression/pathCatalog'
// ─────────────────────────────────────────────────────────────────────────────

import { Shield, EyeOff, TrendingUp, type LucideIcon } from 'lucide-react'
import type { PathId } from '../types/settings.types'

// ─── PathMeta ─────────────────────────────────────────────────────────────────

export interface PathMeta {
  id: PathId
  name: string
  /** Short subtitle shown below the name in compact displays. */
  tagline: string
  /** Full paragraph description shown in ChangePathModal. */
  description: string
  /** Three bullet points shown as passive bonuses. */
  bonuses: readonly string[]
  /** Lucide icon for the path. */
  Icon: LucideIcon
  /** Tailwind bg utility — icon container background. e.g. `bg-muted-emerald/10` */
  iconBg: string
  /** Tailwind text utility — icon and accent text. e.g. `text-muted-emerald` */
  iconColor: string
  /** Tailwind border utility — active/selected card edge. e.g. `border-muted-emerald/40` */
  borderAccent: string
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export const PATH_CATALOG: Record<PathId, PathMeta> = {
  sentinel: {
    id: 'sentinel',
    name: 'Sentinel',
    tagline: 'Defensive mastery',
    description:
      'Fortify your position. Reward cautious, consistent saving and maximise shield recovery on every surplus day.',
    bonuses: [
      '+ Shield effectiveness on daily surplus',
      '+ Emergency fund deposit rewards',
      '+ Bonus HP recovery on zero-spend days',
    ],
    Icon: Shield,
    iconBg: 'bg-muted-emerald/10',
    iconColor: 'text-muted-emerald',
    borderAccent: 'border-muted-emerald/40',
  },

  phantom: {
    id: 'phantom',
    name: 'Phantom',
    tagline: 'Invisible discipline',
    description:
      'Operate beneath the surface. XP multipliers for stealth spending and sustained no-spend streaks compound over time.',
    bonuses: [
      '+ XP multiplier on no-spend days',
      '+ Extended streak bonuses',
      '+ Reduced ghost penalty window',
    ],
    Icon: EyeOff,
    iconBg: 'bg-steel-violet/10',
    iconColor: 'text-steel-violet',
    borderAccent: 'border-steel-violet/40',
  },

  vanguard: {
    id: 'vanguard',
    name: 'Vanguard',
    tagline: 'Aggressive growth',
    description:
      'Push the frontier. Higher XP rewards for income growth and above-target savings performance accelerate your region progression.',
    bonuses: [
      '+ XP bonus on income growth',
      '+ Elevated savings milestone rewards',
      '+ Faster quarterly boss progression',
    ],
    Icon: TrendingUp,
    iconBg: 'bg-dawn-gold/10',
    iconColor: 'text-dawn-gold',
    borderAccent: 'border-dawn-gold/40',
  },
}

/** Ordered array of all paths — use for rendering lists without relying on object key order. */
export const PATH_LIST: PathMeta[] = [
  PATH_CATALOG.sentinel,
  PATH_CATALOG.phantom,
  PATH_CATALOG.vanguard,
]

/** Total cooldown duration in days — sourced from PRD ("6-month cooldown"). */
export const COOLDOWN_TOTAL_DAYS = 180 as const

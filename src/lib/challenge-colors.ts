/**
 * frontend/lib/challenge-colors.ts
 *
 * Single source of truth for challenge color tokens and icon mapping.
 *
 * The backend sends `color` as a semantic key (e.g. "teal", "amber").
 * This file converts that into Tailwind v4 class strings so the
 * backend never needs to know about CSS.
 *
 * Usage
 * -----
 *   import { getChallengeColor } from "@/lib/challenge-colors"
 *
 *   const color = getChallengeColor("teal")
 *   // → { bg, iconBg, iconText, badge, badgeText, ring }
 *
 * Each field is a ready-to-use Tailwind class string.
 * Pass them directly to cn() or className props.
 */

export type ChallengeColorKey =
  | "blue"
  | "teal"
  | "amber"
  | "green"
  | "purple"
  | "coral"
  | "pink"
  | "red"
  | "gray"

export interface ChallengeColorSet {
  /** Faint tinted background for the card or section */
  bg: string
  /** Solid background for the icon pill */
  iconBg: string
  /** Icon color inside the pill */
  iconText: string
  /** Pill/badge background (e.g. difficulty or category tag) */
  badge: string
  /** Text color inside badge */
  badgeText: string
  /** Subtle ring used on hover or active state */
  ring: string
}

/**
 * Map from backend color key → Tailwind v4 class sets.
 *
 * Tailwind v4 note: arbitrary values are preferred over custom config.
 * All colors come from the existing Tailwind palette (no custom tokens
 * needed) so this works with a default v4 setup.
 */
const COLOR_MAP: Record<ChallengeColorKey, ChallengeColorSet> = {
  blue: {
    bg:       "",
    iconBg:   "bg-blue-100 dark:bg-blue-900/60",
    iconText: "text-blue-600 dark:text-blue-400",
    badge:    "bg-blue-100 dark:bg-blue-900/50",
    badgeText:"text-blue-700 dark:text-blue-300",
    ring:     "ring-blue-200 dark:ring-blue-800",
  },
  teal: {
    bg:       "",
    iconBg:   "bg-teal-100 dark:bg-teal-900/60",
    iconText: "text-teal-600 dark:text-teal-400",
    badge:    "bg-teal-100 dark:bg-teal-900/50",
    badgeText:"text-teal-700 dark:text-teal-300",
    ring:     "ring-teal-200 dark:ring-teal-800",
  },
  amber: {
    bg:       "",
    iconBg:   "bg-amber-100 dark:bg-amber-900/60",
    iconText: "text-amber-600 dark:text-amber-400",
    badge:    "bg-amber-100 dark:bg-amber-900/50",
    badgeText:"text-amber-700 dark:text-amber-300",
    ring:     "ring-amber-200 dark:ring-amber-800",
  },
  green: {
    bg:       "",
    iconBg:   "bg-green-100 dark:bg-green-900/60",
    iconText: "text-green-600 dark:text-green-400",
    badge:    "bg-green-100 dark:bg-green-900/50",
    badgeText:"text-green-700 dark:text-green-300",
    ring:     "ring-green-200 dark:ring-green-800",
  },
  purple: {
    bg:       "",
    iconBg:   "bg-purple-100 dark:bg-purple-900/60",
    iconText: "text-purple-600 dark:text-purple-400",
    badge:    "bg-purple-100 dark:bg-purple-900/50",
    badgeText:"text-purple-700 dark:text-purple-300",
    ring:     "ring-purple-200 dark:ring-purple-800",
  },
  coral: {
    bg:       "",
    iconBg:   "bg-orange-100 dark:bg-orange-900/60",
    iconText: "text-orange-600 dark:text-orange-400",
    badge:    "bg-orange-100 dark:bg-orange-900/50",
    badgeText:"text-orange-700 dark:text-orange-300",
    ring:     "ring-orange-200 dark:ring-orange-800",
  },
  pink: {
    bg:       "",
    iconBg:   "bg-pink-100 dark:bg-pink-900/60",
    iconText: "text-pink-600 dark:text-pink-400",
    badge:    "bg-pink-100 dark:bg-pink-900/50",
    badgeText:"text-pink-700 dark:text-pink-300",
    ring:     "ring-pink-200 dark:ring-pink-800",
  },
  red: {
    bg:       "",
    iconBg:   "bg-red-100 dark:bg-red-900/60",
    iconText: "text-red-600 dark:text-red-400",
    badge:    "bg-red-100 dark:bg-red-900/50",
    badgeText:"text-red-700 dark:text-red-300",
    ring:     "ring-red-200 dark:ring-red-800",
  },
  gray: {
    bg:       "",
    iconBg:   "bg-zinc-100 dark:bg-zinc-800/60",
    iconText: "text-zinc-500 dark:text-zinc-400",
    badge:    "bg-zinc-100 dark:bg-zinc-800/50",
    badgeText:"text-zinc-600 dark:text-zinc-400",
    ring:     "ring-zinc-200 dark:ring-zinc-700",
  },
}

const FALLBACK: ChallengeColorSet = COLOR_MAP.gray

/**
 * Returns the Tailwind class set for a given color key.
 * Falls back to gray if an unknown key arrives from the API.
 */
export function getChallengeColor(key: string): ChallengeColorSet {
  return COLOR_MAP[key as ChallengeColorKey] ?? FALLBACK
}

// ---------------------------------------------------------------------------
// Difficulty badge colors (separate from template color — always semantic)
// ---------------------------------------------------------------------------

export type DifficultyKey = "easy" | "medium" | "hard" | "legendary"

export interface DifficultyStyle {
  badge: string
  text: string
  label: string
}

export const DIFFICULTY_STYLES: Record<DifficultyKey, DifficultyStyle> = {
  easy: {
    badge: "bg-emerald-100 dark:bg-emerald-900/50",
    text:  "text-emerald-700 dark:text-emerald-300",
    label: "Easy",
  },
  medium: {
    badge: "bg-yellow-100 dark:bg-yellow-900/50",
    text:  "text-yellow-700 dark:text-yellow-300",
    label: "Medium",
  },
  hard: {
    badge: "bg-red-100 dark:bg-red-900/50",
    text:  "text-red-700 dark:text-red-300",
    label: "Hard",
  },
  legendary: {
    badge: "bg-purple-100 dark:bg-purple-900/50",
    text:  "text-purple-700 dark:text-purple-300",
    label: "Legendary",
  },
}

export function getDifficultyStyle(difficulty: string): DifficultyStyle {
  return DIFFICULTY_STYLES[difficulty as DifficultyKey] ?? DIFFICULTY_STYLES.easy
}

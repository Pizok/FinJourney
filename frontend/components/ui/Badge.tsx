// =============================================================================
// components/ui/Badge.tsx
//
// Shared badge / pill primitive.
//
// Design rules (DESIGN.md §2, labels):
//   - Font: IBM Plex Sans (font-sans), 11px, semibold
//   - Case: ALL-CAPS — badges are the ONLY place uppercase is permitted
//   - Letter-spacing: 0.06em (tracking-[0.06em])
//   - Background: semi-transparent version of accent colour
//   - Border: same accent at low opacity
//   - No shadows, no glows, no heavy decorations
//
// Variant → colour mapping:
//   emerald   → Muted Emerald  — HP, progress, safe states
//   gold      → Dawn Gold      — XP, milestones, next unlock
//   violet    → Steel Violet   — region, path, secondary accent
//   terracotta→ Terracotta     — danger, low HP, warnings
//   muted     → Muted Text     — neutral / past events
// =============================================================================

import { cn } from "@/lib/utils";

// ─── Variant definitions ──────────────────────────────────────────────────────
// Each entry is [text class, background class, border class].
// All use opacity modifiers (/10 = 10% alpha, /25 = 25% alpha) so colours
// stay within the palette without hardcoding hex values.

const variants = {
  emerald: [
    "text-muted-emerald",
    "bg-muted-emerald/10",
    "border-muted-emerald/25",
  ],
  gold: [
    "text-dawn-gold",
    "bg-dawn-gold/10",
    "border-dawn-gold/25",
  ],
  violet: [
    "text-steel-violet",
    "bg-steel-violet/10",
    "border-steel-violet/25",
  ],
  terracotta: [
    "text-terracotta",
    "bg-terracotta/10",
    "border-terracotta/25",
  ],
  muted: [
    "text-muted-text",
    "bg-tactical-border/30",
    "border-tactical-border/50",
  ],
} as const;

export type BadgeVariant = keyof typeof variants;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BadgeProps {
  children: React.ReactNode;
  /**
   * Design-system colour variant.
   * @default 'muted'
   */
  variant?: BadgeVariant;
  /**
   * Optional lucide-react icon rendered before the label text.
   * Pass the icon element directly: icon={<Route size={10} strokeWidth={2} />}
   */
  icon?: React.ReactNode;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Badge({
  children,
  variant = "muted",
  icon,
  className,
}: BadgeProps) {
  const [textClass, bgClass, borderClass] = variants[variant];

  return (
    <span
      className={cn(
        // Layout
        "inline-flex items-center gap-[3px]",
        // Geometry
        "px-2 py-[2px] rounded-full",
        // Typography — uppercase label style per DESIGN.md §2
        "font-sans text-[11px] font-semibold",
        "uppercase tracking-[0.06em]",
        // Colour
        textClass,
        bgClass,
        "border",
        borderClass,
        className
      )}
    >
      {icon && (
        <span className="shrink-0 leading-none" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
// Maps ChallengeStatus / ReviewStatus to the correct variant automatically.

type StatusValue = "active" | "completed" | "failed" | "upcoming" | string;

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  active: "emerald",
  completed: "muted",
  failed: "terracotta",
  upcoming: "violet",
};

export interface StatusBadgeProps {
  status: StatusValue;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = STATUS_VARIANT[status] ?? "muted";
  return (
    <Badge variant={variant} className={className}>
      {status}
    </Badge>
  );
}

// ─── DayBadge ─────────────────────────────────────────────────────────────────
// Inline account-day counter — not uppercase, slightly different styling.
// Used in JourneyHeader and region tooltips.

export interface DayBadgeProps {
  day: number;
  className?: string;
}

export function DayBadge({ day, className }: DayBadgeProps) {
  return (
    <span
      className={cn(
        "font-sans text-[12px] text-muted-text",
        className
      )}
    >
      Day {day}
    </span>
  );
}

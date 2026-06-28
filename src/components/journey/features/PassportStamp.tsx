"use client";

// =============================================================================
// features/journey/components/PassportStamp.tsx
//
// Atomic stamp tile component — two variants:
//
//   EarnedStamp  → clickable tile showing region, date, and active/done state
//   LockedStamp  → non-interactive dashed placeholder with requirement text
//
// Both are used inside the PassportSection grid.
//
// EarnedStamp design:
//   - Award icon in a colour-accented container
//     - active stamps (current region): muted-emerald accent
//     - completed stamps (past regions): steel-violet accent
//   - Region name: font-sans, 11px, semibold, pearl-text
//   - Date: font-sans, 10px, muted-text
//   - Hover: border shifts to dawn-gold, card lifts 2px (transform)
//   - Focus-visible ring for keyboard accessibility
//   - No outer glow — elevation is conveyed through border change only
//
// LockedStamp design:
//   - Dashed tactical-border border, 40% opacity
//   - Lock icon: muted-text
//   - Requirement text: font-sans, 10px, muted-text
//   - Not focusable, not interactive, aria-hidden
//
// Grid sizing:
//   Both tiles use the same fixed height (auto) and a consistent min-width
//   so the CSS grid can pack them uniformly. Text truncation with title
//   attribute ensures no stamp silently clips long region names.
// =============================================================================

import { useState } from "react";
import { Award, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PassportStamp as PassportStampType, LockedStamp } from "@/components/journey/types/journey.types";

// ─── Earned stamp ─────────────────────────────────────────────────────────────

export interface EarnedStampProps {
  stamp: PassportStampType;
  onSelect: (stamp: PassportStampType) => void;
}

export function EarnedStamp({ stamp, onSelect }: EarnedStampProps) {
  const [hovered, setHovered] = useState(false);

  /*
   * Visual accent:
   *   active stamps belong to the current region — use muted-emerald to
   *   signal ongoing progress rather than completion.
   *   completed stamps are historical — use steel-violet (secondary accent).
   */
  const isActive = stamp.type === "active";
  const accentColor = isActive ? "muted-emerald" : "steel-violet";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Passport stamp: ${stamp.title}, earned ${stamp.date}, ${stamp.requirement}`}
      onClick={() => onSelect(stamp)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(stamp);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      data-testid={`passport-stamp-${stamp.id}`}
      className={cn(
        // Base surface
        "flex flex-col items-center gap-2",
        "p-4 rounded-xl",
        "bg-canvas-surface",
        "border",
        "cursor-pointer select-none",
        // Border transitions: active → muted-emerald, hover/focus → dawn-gold
        isActive && !hovered
          ? "border-muted-emerald/50"
          : hovered
          ? "border-dawn-gold/60"
          : "border-tactical-border",
        // Elevation via transform — no box-shadow
        hovered ? "-translate-y-[2px]" : "translate-y-0",
        "transition-all duration-200",
        // Focus ring
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-muted-emerald focus-visible:ring-offset-2",
        "focus-visible:ring-offset-abyssal-slate"
      )}
    >
      {/* Award icon container */}
      <div
        className={cn(
          "flex items-center justify-center",
          "w-9 h-9 rounded-lg",
          accentColor === "muted-emerald"
            ? "bg-muted-emerald/12 text-muted-emerald"
            : "bg-steel-violet/12 text-steel-violet"
        )}
        aria-hidden="true"
      >
        <Award size={18} strokeWidth={2} />
      </div>

      {/* Stamp title — truncate with title for overflow */}
      <span
        className="font-sans text-[11px] font-semibold text-pearl-text text-center leading-tight line-clamp-2"
        title={stamp.title}
      >
        {stamp.title}
      </span>

      {/* Date */}
      <span className="font-sans text-[10px] text-muted-text">
        {stamp.date.split('T')[0]}
      </span>
    </div>
  );
}

// ─── Locked stamp ─────────────────────────────────────────────────────────────

export interface LockedStampProps {
  slot: LockedStamp;
}

export function LockedStampTile({ slot }: LockedStampProps) {
  return (
    <div
      aria-hidden="true"  // Locked slots are decorative — not actionable
      className={cn(
        "flex flex-col items-center justify-center gap-2",
        "p-4 rounded-xl",
        // Dashed border signals unavailability clearly
        "border border-dashed border-tactical-border/40",
        // Dimmed to stay clearly behind earned stamps
        "opacity-40",
        "min-h-[112px]",
        "text-center"
      )}
      data-testid={`passport-locked-${slot.id}`}
    >
      <Lock
        size={15}
        strokeWidth={2}
        className="text-muted-text"
        aria-hidden="true"
      />
      <span className="font-sans text-[10px] text-muted-text leading-tight px-1">
        {slot.requirement}
      </span>
    </div>
  );
}

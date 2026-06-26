"use client";

// =============================================================================
// features/journey/components/HistoryEvent.tsx
//
// Single event row within the Journey History section.
//
// Content:
//   - Severity-coloured icon container (30×30 rounded-lg)
//   - Event title (left) + date label (right)
//   - XP and/or HP delta chips below the title (when non-zero)
//   - Bottom border separator — omitted on the last row (isLast prop)
//
// Event type → icon mapping:
//   achievement  → CheckCircle
//   penalty      → AlertTriangle
//   milestone    → Star
//   task         → Target
//   hazard       → Flame
//   region       → MapPin
//   (fallback)   → Activity
//
// Severity → colour mapping (Tailwind classes):
//   success   → muted-emerald
//   danger    → terracotta
//   milestone → dawn-gold
//   info      → steel-violet
//   warning   → dawn-gold
//
// Delta chips:
//   Positive XP (+10 XP) → dawn-gold
//   Negative XP (−5 XP)  → terracotta
//   Positive HP (+10 HP) → muted-emerald
//   Negative HP (−8 HP)  → terracotta
//   Zero deltas are not rendered.
//
// Design rules:
//   - No hover state — history rows are read-only (not interactive)
//   - No hardcoded hex values
//   - Text strictly WCAG AA on canvas-surface background
//   - Date text is tabular-nums for alignment in the column
// =============================================================================

import {
  CheckCircle,
  AlertTriangle,
  Star,
  Target,
  Flame,
  MapPin,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HistoryEvent as HistoryEventType, EventSeverity } from "@/components/journey/types/journey.types";

// ─── Icon registry ────────────────────────────────────────────────────────────

type EventType = HistoryEventType["type"];

const EVENT_ICONS: Record<EventType, React.ReactNode> = {
  achievement: <CheckCircle size={13} strokeWidth={2} aria-hidden="true" />,
  penalty: <AlertTriangle size={13} strokeWidth={2} aria-hidden="true" />,
  milestone: <Star size={13} strokeWidth={2} aria-hidden="true" />,
  task: <Target size={13} strokeWidth={2} aria-hidden="true" />,
  hazard: <Flame size={13} strokeWidth={2} aria-hidden="true" />,
  region: <MapPin size={13} strokeWidth={2} aria-hidden="true" />,
};

const FALLBACK_ICON = <Activity size={13} strokeWidth={2} aria-hidden="true" />;

// ─── Severity → colour config ────────────────────────────────────────────────

interface SeverityColors {
  iconText: string;
  iconBg: string;
}

const SEVERITY_COLORS: Record<EventSeverity, SeverityColors> = {
  success: {
    iconText: "text-muted-emerald",
    iconBg: "bg-muted-emerald/10",
  },
  danger: {
    iconText: "text-terracotta",
    iconBg: "bg-terracotta/10",
  },
  milestone: {
    iconText: "text-dawn-gold",
    iconBg: "bg-dawn-gold/10",
  },
  info: {
    iconText: "text-steel-violet",
    iconBg: "bg-steel-violet/10",
  },
  warning: {
    iconText: "text-dawn-gold",
    iconBg: "bg-dawn-gold/10",
  },
};

// ─── Delta chip ───────────────────────────────────────────────────────────────

interface DeltaChipProps {
  value: number;
  unit: "XP" | "HP";
}

function DeltaChip({ value, unit }: DeltaChipProps) {
  if (value === 0) return null;

  const isPositive = value > 0;
  const isHP = unit === "HP";

  const colorClass = isPositive
    ? isHP
      ? "text-muted-emerald"
      : "text-dawn-gold"
    : "text-terracotta";

  return (
    <span
      className={cn("font-sans text-[11px] tabular-nums", colorClass)}
      aria-label={`${isPositive ? "+" : ""}${value} ${unit}`}
    >
      {isPositive ? "+" : ""}
      {value} {unit}
    </span>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HistoryEventProps {
  event: HistoryEventType;
  /**
   * When true, omits the bottom border separator.
   * The parent (HistorySection) determines this based on array index.
   */
  isLast: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HistoryEvent({ event, isLast }: HistoryEventProps) {
  const icon = EVENT_ICONS[event.type] ?? FALLBACK_ICON;
  const colors = SEVERITY_COLORS[event.severity] ?? SEVERITY_COLORS.info;

  const hasDeltas = event.xp_change !== 0 || event.hp_change !== 0;

  return (
    <div
      className={cn(
        "flex items-start gap-3",
        "px-5 py-4",
        !isLast && "border-b border-tactical-border"
      )}
      data-testid={`history-event-${event.id}`}
    >
      {/* ── Severity icon container ──────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center justify-center shrink-0",
          "w-[30px] h-[30px] rounded-lg",
          colors.iconText,
          colors.iconBg,
          // Top-align with title (mt-[1px] compensates for the font's
          // internal leading at 13px body text)
          "mt-[1px]"
        )}
        aria-hidden="true"
      >
        {icon}
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Title + date row */}
        <div className="flex items-start justify-between gap-3">
          <span className="font-sans text-[13px] font-medium text-pearl-text leading-snug">
            {event.title}
          </span>
          <span
            className="font-sans text-[11px] text-muted-text whitespace-nowrap shrink-0 tabular-nums"
            aria-label={`Date: ${event.date}`}
          >
            {event.date}
          </span>
        </div>

        {/* Delta chips — only when there's something to show */}
        {hasDeltas && (
          <div
            className="flex items-center gap-3 mt-[3px]"
            aria-label={`Changes: ${event.xp_change !== 0 ? `${event.xp_change > 0 ? "+" : ""}${event.xp_change} XP` : ""}${
              event.xp_change !== 0 && event.hp_change !== 0 ? ", " : ""
            }${event.hp_change !== 0 ? `${event.hp_change > 0 ? "+" : ""}${event.hp_change} HP` : ""}`}
          >
            <DeltaChip value={event.xp_change} unit="XP" />
            <DeltaChip value={event.hp_change} unit="HP" />
          </div>
        )}
      </div>
    </div>
  );
}

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
  TrendingDown,
  TrendingUp,
  Wallet,
  Tag,
  Heart,
  Skull,
  ShieldOff,
  ShieldCheck,
  Zap,
  ArrowUpCircle,
  Unlock,
  Trophy,
  XCircle,
  Gift,
  Sun,
  PauseCircle,
  Shuffle,
  Settings,
  Moon,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HistoryEvent as HistoryEventType, EventSeverity } from "@/components/journey/types/journey.types";

// ─── Icon registry ────────────────────────────────────────────────────────────

type EventType = HistoryEventType["type"];

const EVENT_ICONS: Partial<Record<EventType, React.ReactNode>> = {
  // Abstract (legacy)
  achievement: <CheckCircle size={13} strokeWidth={2} aria-hidden="true" />,
  penalty:     <AlertTriangle size={13} strokeWidth={2} aria-hidden="true" />,
  milestone:   <Star size={13} strokeWidth={2} aria-hidden="true" />,
  task:        <Target size={13} strokeWidth={2} aria-hidden="true" />,
  hazard:      <Flame size={13} strokeWidth={2} aria-hidden="true" />,
  region:      <MapPin size={13} strokeWidth={2} aria-hidden="true" />,
  // Transactions
  expense_logged:         <TrendingDown size={13} strokeWidth={2} aria-hidden="true" />,
  income_logged:          <TrendingUp size={13} strokeWidth={2} aria-hidden="true" />,
  transaction_adjustment: <RefreshCw size={13} strokeWidth={2} aria-hidden="true" />,
  // Wallet & categories
  wallet_created:   <Wallet size={13} strokeWidth={2} aria-hidden="true" />,
  category_created: <Tag size={13} strokeWidth={2} aria-hidden="true" />,
  category_updated: <Tag size={13} strokeWidth={2} aria-hidden="true" />,
  // HP events
  hp_changed:               <Heart size={13} strokeWidth={2} aria-hidden="true" />,
  hp_critical_failure:      <Skull size={13} strokeWidth={2} aria-hidden="true" />,
  overspend_detected:       <AlertTriangle size={13} strokeWidth={2} aria-hidden="true" />,
  ghost_penalty_applied:    <Flame size={13} strokeWidth={2} aria-hidden="true" />,
  shield_generated:         <ShieldCheck size={13} strokeWidth={2} aria-hidden="true" />,
  shield_destroyed:         <ShieldOff size={13} strokeWidth={2} aria-hidden="true" />,
  financial_audit_completed:<CheckCircle size={13} strokeWidth={2} aria-hidden="true" />,
  // XP & levelling
  xp_changed:      <Zap size={13} strokeWidth={2} aria-hidden="true" />,
  level_up:        <ArrowUpCircle size={13} strokeWidth={2} aria-hidden="true" />,
  feature_unlocked:<Unlock size={13} strokeWidth={2} aria-hidden="true" />,
  // Journey / region
  region_shift_pending:   <MapPin size={13} strokeWidth={2} aria-hidden="true" />,
  region_shift_completed: <MapPin size={13} strokeWidth={2} aria-hidden="true" />,
  passport_stamp_earned:  <Star size={13} strokeWidth={2} aria-hidden="true" />,
  challenge_completed:    <Trophy size={13} strokeWidth={2} aria-hidden="true" />,
  quarter_failed:         <XCircle size={13} strokeWidth={2} aria-hidden="true" />,
  reward_claimed:         <Gift size={13} strokeWidth={2} aria-hidden="true" />,
  // Survival / daily
  zero_spend_claimed: <Sun size={13} strokeWidth={2} aria-hidden="true" />,
  standby_activated:  <PauseCircle size={13} strokeWidth={2} aria-hidden="true" />,
  standby_used:       <Shuffle size={13} strokeWidth={2} aria-hidden="true" />,
  // Settings / system
  path_changed:                <Settings size={13} strokeWidth={2} aria-hidden="true" />,
  midnight_evaluation_started: <Moon size={13} strokeWidth={2} aria-hidden="true" />,
};

const FALLBACK_ICON = <Activity size={13} strokeWidth={2} aria-hidden="true" />;

/** Human-readable labels for raw backend event_type values. */
const TITLE_MAP: Partial<Record<EventType, string>> = {
  // Transactions
  expense_logged:         "Expense Logged",
  income_logged:          "Income Logged",
  transaction_adjustment: "Transaction Adjusted",
  // Wallet & categories
  wallet_created:   "Wallet Created",
  category_created: "Category Created",
  category_updated: "Category Updated",
  // HP events
  hp_changed:               "HP Changed",
  hp_critical_failure:      "Critical Failure",
  overspend_detected:       "Overspend Detected",
  ghost_penalty_applied:    "Ghost Penalty Applied",
  shield_generated:         "Shield Activated",
  shield_destroyed:         "Shield Broken",
  financial_audit_completed:"Financial Audit Completed",
  // XP & levelling
  xp_changed:      "XP Gained",
  level_up:        "Level Up!",
  feature_unlocked:"Feature Unlocked",
  // Journey / region
  region_shift_pending:   "Region Shift Pending",
  region_shift_completed: "Region Completed",
  passport_stamp_earned:  "Passport Stamp Earned",
  challenge_completed:    "Challenge Completed",
  quarter_failed:         "Quarter Failed",
  reward_claimed:         "Reward Claimed",
  // Survival / daily
  zero_spend_claimed: "Zero-Spend Day Claimed",
  standby_activated:  "Standby Mode Activated",
  standby_used:       "Standby Used",
  // Settings / system
  path_changed:                "Path Changed",
  midnight_evaluation_started: "Daily Evaluation",
};

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

  // Resolve a human-readable title.
  // Priority: TITLE_MAP lookup → backend-provided title (if not a raw type string) → formatted type.
  const mappedTitle = TITLE_MAP[event.type];
  const displayTitle =
    mappedTitle ??
    (event.title && event.title !== event.type
      ? event.title
      : event.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));

  // Format the date string
  // event.date is an ISO string (e.g. "2026-06-27T18:41:34Z") from the backend
  let displayDate = event.date;
  try {
    const d = new Date(event.date);
    if (!isNaN(d.getTime())) {
      const isLessThan24h = Date.now() - d.getTime() < 24 * 60 * 60 * 1000;
      if (isLessThan24h) {
        displayDate = new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          minute: "2-digit",
        }).format(d);
      } else {
        displayDate = new Intl.DateTimeFormat(undefined, {
          month: "short",
          day: "numeric",
        }).format(d);
      }
    }
  } catch {
    // fallback to raw string if parsing fails
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3",
        "px-5 py-[18px]",
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
            {displayTitle}
          </span>
          <span
            className="font-sans text-[11px] text-muted-text whitespace-nowrap shrink-0 tabular-nums"
            aria-label={`Date: ${displayDate}`}
          >
            {displayDate}
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

"use client";

// =============================================================================
// features/journey/components/JourneyHeader.tsx
//
// Top-of-page header for the Journey page.
//
// Content (per Journey Page Specification §5 — JourneyHeader):
//   - Current region badge (Steel Violet)
//   - Current account day indicator
//   - "The Journey" H1 — the only h1 on the page
//   - Three-part progress summary:
//       N regions completed · X% of current cycle · Next milestone in Y days
//
// Data:
//   Reads from useOverviewData() — the Zustand selector that falls back to
//   MOCK_JOURNEY_OVERVIEW during development. When TanStack Query resolves,
//   the store is updated and this component re-renders automatically.
//
// Skeleton:
//   The parent JourneyPageClient passes isLoading while the overview query
//   is in its initial loading state. The skeleton preserves layout space
//   exactly (same height as the loaded state) to prevent layout shift.
//
// Typography (DESIGN.md §2):
//   H1  → font-display (Source Sans 3), semibold, 28px, tracking-tight
//   Meta→ font-sans (IBM Plex Sans), 14px, text-muted-text
//   Badge → font-sans, 11px, uppercase, 0.06em tracking
//
// Rules:
//   - No hardcoded hex values
//   - No glow effects
//   - Cycle percentage is calculated from two server-integer values (days /
//     total_days). This is a display-only division, NOT a game mechanic.
//     Backend authority applies to HP, XP, level, and shields — not UI math.
// =============================================================================

import { Route } from "lucide-react";
import { Badge, DayBadge } from "@/components/ui/Badge";
import { useOverviewData } from "@/components/journey/stores/journeyStore";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function HeaderSkeleton() {
  return (
    <div
      className="pt-8 pb-6"
      aria-busy="true"
      aria-label="Loading journey header"
      data-testid="journey-header-skeleton"
    >
      {/* Badge row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="h-[22px] w-36 rounded-full bg-canvas-surface animate-pulse" />
        <div className="h-[22px] w-14 rounded-full bg-canvas-surface animate-pulse" />
      </div>
      {/* H1 */}
      <div className="h-[34px] w-48 rounded-md bg-canvas-surface animate-pulse mb-2.5" />
      {/* Subtitle */}
      <div className="h-[18px] w-72 rounded bg-canvas-surface animate-pulse" />
    </div>
  );
}

// ─── Progress summary ─────────────────────────────────────────────────────────

interface ProgressSummaryProps {
  completedRegions: number;
  cyclePct: number;
  nextMilestoneDays: number;
}

function ProgressSummary({
  completedRegions,
  cyclePct,
  nextMilestoneDays,
}: ProgressSummaryProps) {
  const segments = [
    `${completedRegions} ${completedRegions === 1 ? "region" : "regions"} completed`,
    `${cyclePct}% of current cycle`,
    `Next milestone in ${nextMilestoneDays} ${nextMilestoneDays === 1 ? "day" : "days"}`,
  ];

  return (
    <p
      className="font-sans text-sm text-muted-text leading-relaxed"
      aria-label="Journey progress summary"
    >
      {segments.map((seg, i) => (
        <span key={seg}>
          {seg}
          {i < segments.length - 1 && (
            <span className="mx-[5px] opacity-40" aria-hidden="true">
              &middot;
            </span>
          )}
        </span>
      ))}
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface JourneyHeaderProps {
  /**
   * Passed by JourneyPageClient while the overview query is loading.
   * Renders a layout-stable skeleton until real data arrives.
   */
  isLoading?: boolean;
}

export function JourneyHeader({ isLoading = false }: JourneyHeaderProps) {
  const overview = useOverviewData();

  if (isLoading) return <HeaderSkeleton />;

  const { current_region, journey_progress } = overview;

  /*
   * Display percentage derived from server data (account_days / 365).
   * This is presentation math only — never used as a progression gate.
   * The backend is authoritative for all milestone/unlock decisions.
   */
  const cyclePct = Math.min(
    100,
    Math.round((journey_progress.account_days / 365) * 100)
  );

  return (
    <header
      className="pt-8 pb-6 animate-fade-in"
      data-testid="journey-header"
    >
      {/* ── Badge row ───────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 mb-3"
        role="group"
        aria-label="Current region and account day"
      >
        <Badge
          variant="violet"
          icon={<Route size={10} strokeWidth={2} />}
        >
          {current_region.name}
        </Badge>
        <DayBadge day={journey_progress.account_days} />
      </div>

      {/* ── Page title ──────────────────────────────────────────────────── */}
      {/*
       * The sole h1 on the Journey page.
       * font-display → Source Sans 3, per DESIGN.md §2 "Headers / Large Numbers"
       * text-[28px]  → custom size between Tailwind's text-2xl (24) and text-3xl (30)
       * tracking-tight → -0.02em, standard for display headings in this system
       */}
      <h1
        className={[
          "font-display text-[28px] font-semibold",
          "text-pearl-text",
          "tracking-tight leading-tight",
          "mb-2",
        ].join(" ")}
      >
        The Journey
      </h1>

      {/* ── Progress summary line ─────────────────────────────────────── */}
      <ProgressSummary
        completedRegions={journey_progress.completed_regions}
        cyclePct={cyclePct}
        nextMilestoneDays={journey_progress.next_milestone_days}
      />
    </header>
  );
}

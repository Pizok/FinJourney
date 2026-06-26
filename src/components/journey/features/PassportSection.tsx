"use client";

// =============================================================================
// features/journey/components/PassportSection.tsx
//
// Passport & Achievements section of the Journey page.
//
// Content (Journey Page Specification §5 — PassportSection):
//   - Section label "Passport & Achievements"
//   - Stamp count chip: "3 / 12 stamps" — right-aligned
//   - Responsive CSS grid of:
//       • Earned stamp tiles (active and completed)
//       • Locked stamp placeholder tiles
//   - Empty state when stamps === 0: "No stamps earned."
//
// Grid layout:
//   grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5
//   gap-3 — tight enough to feel like a collection, not sprawling
//
// Loading skeleton:
//   Same grid, replaced with shimmer rectangles of matching height.
//
// Interaction:
//   Earned stamps call openStampModal(stamp) via the Zustand store.
//   Locked tiles are aria-hidden and non-interactive.
//
// Spec empty state copy:
//   "No stamps earned."
//   Description: "Complete regional cycles and quarterly challenges to earn
//   passport stamps."
// =============================================================================

import { useCallback } from "react";
import { Scroll } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { EarnedStamp, LockedStampTile } from "./PassportStamp";
import { useModalActions } from "@/components/journey/stores/journeyStore";
import { useJourneyData } from "../layout/JourneyContext";
import type { PassportStamp } from "@/components/journey/types/journey.types";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SKELETON_COUNT = 8;

function PassportSkeleton() {
  return (
    <section aria-label="Passport loading" aria-busy="true">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-3 w-44 rounded bg-canvas-surface animate-pulse" />
        <div className="h-4 w-20 rounded-full bg-canvas-surface animate-pulse" />
      </div>
      {/* Grid skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <div
            key={i}
            className="h-[112px] rounded-xl bg-canvas-surface animate-pulse"
            aria-hidden="true"
          />
        ))}
      </div>
    </section>
  );
}

// ─── Stamp count chip ─────────────────────────────────────────────────────────

interface StampCountProps {
  earned: number;
  total: number;
}

function StampCount({ earned, total }: StampCountProps) {
  return (
    <span
      className="font-sans text-[12px] text-muted-text tabular-nums"
      aria-label={`${earned} of ${total} stamps earned`}
    >
      {earned} / {total} stamps
    </span>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel() {
  return (
    <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-text">
      Passport &amp; Achievements
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface PassportSectionProps {
  isLoading?: boolean;
}

export function PassportSection({ isLoading = false }: PassportSectionProps) {
  const overview = useJourneyData();
  const { openStampModal } = useModalActions();

  const handleStampSelect = useCallback(
    (stamp: PassportStamp) => {
      openStampModal(stamp);
    },
    [openStampModal]
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) return <PassportSkeleton />;

  const passport = overview.passport;
  const stamps = passport?.stamps ?? [];
  const locked = passport?.locked ?? [];
  const stampsEarned = passport?.stamps_earned ?? 0;
  const totalAvailable = passport?.total_available ?? 12;

  // ── Empty ────────────────────────────────────────────────────────────────
  if (stamps.length === 0) {
    return (
      <section
        aria-label="Passport and achievements"
        className="animate-fade-in"
        data-testid="passport-section"
      >
        <div className="flex items-center justify-between mb-4">
          <SectionLabel />
          <StampCount earned={stampsEarned} total={totalAvailable} />
        </div>
        <EmptyState
          icon={Scroll}
          message="No stamps earned."
          description="Complete regional cycles and quarterly challenges to earn passport stamps."
        />
      </section>
    );
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  return (
    <section
      aria-label="Passport and achievements"
      className="animate-fade-in"
      data-testid="passport-section"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <SectionLabel />
        <StampCount earned={stampsEarned} total={totalAvailable} />
      </div>

      {/*
       * Stamp grid.
       *
       * Earned stamps appear first (active before completed, matching the
       * order returned by the API). Locked slots follow to fill the grid,
       * capped at 9 to keep the section from becoming overwhelming.
       *
       * Responsive columns:
       *   2 on mobile → 3 tablet → 4 laptop → 5 wide desktop
       * This matches the stamp card min-width so they never feel cramped.
       */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
        role="list"
        aria-label="Passport stamps"
      >
        {/* Earned stamps */}
        {stamps.map((stamp) => (
          <div role="listitem" key={stamp.id}>
            <EarnedStamp stamp={stamp} onSelect={handleStampSelect} />
          </div>
        ))}

        {/*
         * Locked slots — show up to 9 so there's always visible progress
         * potential without the grid feeling endless.
         * aria-hidden since they convey no actionable information to SR users.
         */}
        {locked.slice(0, 9).map((slot) => (
          <div role="presentation" key={slot.id} aria-hidden="true">
            <LockedStampTile slot={slot} />
          </div>
        ))}
      </div>
    </section>
  );
}

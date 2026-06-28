"use client";

// =============================================================================
// features/journey/components/HistorySection.tsx
//
// Journey History — the financial story log at the bottom of the Journey page.
//
// Content (Journey Page Specification §5 — HistorySection):
//   - Section label "Journey History"
//   - Vertical list of HistoryEvent rows inside a single Card
//   - "Load more events" button — triggers additional page fetches
//   - Empty state: "No story recorded."
//
// Pagination strategy (spec §5 — Behavior: Infinite Scroll):
//   The overview already provides the first N events (recent_events).
//   This component displays those immediately (no additional fetch on mount).
//   When the user clicks "Load more", GET /api/v1/journey/history?page=2
//   is fetched via useInfiniteQuery, and subsequent pages follow.
//
//
//   Live mode:
//     overview.recent_events seeds page 1.
//     useInfiniteQuery is enabled on first "Load more" click,
//     starting from page 2. The button disappears when hasNextPage is false.
//
// Cache invalidation:
//   The ['journey', 'history'] key is invalidated on window refocus by
//   JourneyPageClient (same invalidation set as the overview query).
//
// Design rules:
//   - Events grouped in one Card (padding="none") — unified container
//   - No hover interaction on rows — history is read-only
//   - "Load more" button: ghost style, full-width, inside the Card border
//   - Spinner on the load-more button when isFetchingNextPage
//   - No glow, no shadows
// =============================================================================

import { BookOpen } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { HistoryEvent } from "./HistoryEvent";
import { useJourneyData } from "../layout/JourneyContext";
import { useModalActions } from "@/components/journey/stores/journeyStore";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

/** How many events to show from the overview before the "See more" button */
const INITIAL_VISIBLE = 5;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SKELETON_ROWS = 4;

function EventRowSkeleton({ isLast }: { isLast: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-5 py-4",
        !isLast && "border-b border-tactical-border"
      )}
      aria-hidden="true"
    >
      {/* Icon placeholder */}
      <div className="w-[30px] h-[30px] rounded-lg bg-abyssal-slate animate-pulse shrink-0 mt-[1px]" />
      {/* Content */}
      <div className="flex-1 flex flex-col gap-2 pt-[2px]">
        <div className="flex items-start justify-between gap-3">
          <div className="h-[13px] w-48 rounded bg-abyssal-slate animate-pulse" />
          <div className="h-[11px] w-16 rounded bg-abyssal-slate animate-pulse shrink-0" />
        </div>
        <div className="h-[11px] w-24 rounded bg-abyssal-slate animate-pulse" />
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <section aria-label="Journey history loading" aria-busy="true">
      {/* Section label skeleton */}
      <div className="h-3 w-32 rounded bg-canvas-surface animate-pulse mb-4" />
      <Card padding="none">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <EventRowSkeleton key={i} isLast={i === SKELETON_ROWS - 1} />
        ))}
      </Card>
    </section>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel() {
  return (
    <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-text mb-4">
      Journey History
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface HistorySectionProps {
  isLoading?: boolean;
}

export function HistorySection({ isLoading = false }: HistorySectionProps) {
  const overview = useJourneyData();
  const { openHistoryModal } = useModalActions();

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) return <HistorySkeleton />;

  // ── Event list assembly ──────────────────────────────────────────────────
  const overviewEvents = overview.recent_events ?? [];
  const events = overviewEvents.slice(0, INITIAL_VISIBLE);
  const hasMore = overviewEvents.length > INITIAL_VISIBLE;

  // ── Empty ────────────────────────────────────────────────────────────────
  if (events.length === 0) {
    return (
      <section
        aria-label="Journey history"
        className="animate-fade-in h-full flex flex-col"
        data-testid="history-section"
      >
        <SectionLabel />
        <EmptyState
          className="flex-1 flex flex-col items-center justify-center"
          icon={BookOpen}
          message="No story recorded."
          description="Transactions, achievements, and milestones you reach will appear here."
        />
      </section>
    );
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  return (
    <section
      aria-label="Journey history"
      className="animate-fade-in h-full flex flex-col"
      data-testid="history-section"
    >
      <SectionLabel />

      {/*
       * Single Card wraps all rows.
       * padding="none" so each HistoryEvent controls its own horizontal
       * padding — this lets the separator borders run full-width inside
       * the card without clipping.
       */}
      <Card padding="none" aria-live="polite" aria-relevant="additions" className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
        {events.map((event, index) => (
          <HistoryEvent
            key={event.id}
            event={event}
            isLast={index === events.length - 1 && !hasMore}
          />
        ))}

        {/*
         * See more button — sits inside the Card so its top border
         * aligns with the last event's bottom separator, creating a
         * seamless extension of the list rather than a detached button.
         */}

        </div>

        {hasMore && (
          <div className="border-t border-tactical-border">
            <button
              onClick={openHistoryModal}
              aria-label="See more events"
              className={cn(
                "flex items-center justify-center gap-2",
                "w-full px-5 py-3",
                "font-sans text-[13px] text-pearl-text",
                "bg-transparent",
                "hover:bg-tactical-border/20",
                "transition-colors duration-200",
                "cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-inset focus-visible:ring-muted-emerald/50"
              )}
            >
              See more
            </button>
          </div>
        )}
      </Card>
    </section>
  );
}

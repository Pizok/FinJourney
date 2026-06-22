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
//   Mock mode (useMockData === true):
//     Paginates the mock recent_events array locally.
//     INITIAL_VISIBLE events are shown; "Load more" reveals the rest.
//     No network requests are made.
//
//   Live mode (useMockData === false):
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

import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { HistoryEvent } from "./HistoryEvent";
import { useJourneyStore } from "@/components/journey/stores/journeyStore";
import { useJourneyData } from "../layout/JourneyContext";
import {
  JOURNEY_QUERY_KEYS,
  type HistoryPage,
  type ApiResponse,
} from "@/components/journey/types/journey.types";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

/** How many events to show from the overview before the "Load more" button */
const INITIAL_VISIBLE = 5;

// ─── API fetcher ──────────────────────────────────────────────────────────────

async function fetchHistoryPage(page: number): Promise<HistoryPage> {
  const res = await fetch(`/api/v1/journey/history?page=${page}`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`History page ${page} request failed: ${res.status}`);
  }

  const json: ApiResponse<HistoryPage> = await res.json();

  if (!json.success) {
    throw new Error(json.error.message);
  }

  return json.data;
}

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

// ─── Load more button ─────────────────────────────────────────────────────────

interface LoadMoreButtonProps {
  onClick: () => void;
  isLoading: boolean;
}

function LoadMoreButton({ onClick, isLoading }: LoadMoreButtonProps) {
  return (
    <div className="border-t border-tactical-border">
      <button
        onClick={onClick}
        disabled={isLoading}
        aria-label={isLoading ? "Loading more events" : "Load more events"}
        className={cn(
          "flex items-center justify-center gap-2",
          "w-full px-5 py-3",
          "font-sans text-[13px] text-pearl-text",
          "bg-transparent",
          "hover:bg-tactical-border/20",
          "transition-colors duration-200",
          "cursor-pointer disabled:cursor-default",
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-inset focus-visible:ring-muted-emerald/50"
        )}
      >
        <RefreshCw
          size={13}
          strokeWidth={2}
          aria-hidden="true"
          className={cn(isLoading && "animate-spin")}
        />
        {isLoading ? "Loading…" : "Load more events"}
      </button>
    </div>
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
  const useMockData = useJourneyStore((s) => s.useMockData);

  // ── Mock mode state ──────────────────────────────────────────────────────
  // Locally pages the mock array without any network requests.
  const [mockExpanded, setMockExpanded] = useState(false);

  // ── Live mode state ──────────────────────────────────────────────────────
  // Deferred: the infinite query is only enabled after the first "Load more".
  // This avoids a redundant network call on page mount — the overview already
  // provides the first batch of events.
  const [liveEnabled, setLiveEnabled] = useState(false);

  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: JOURNEY_QUERY_KEYS.history(),
    queryFn: ({ pageParam }) => fetchHistoryPage(pageParam as number),
    // Start from page 2 — page 1 is seeded from overview.recent_events
    initialPageParam: 2 as number,
    getNextPageParam: (lastPage) =>
      lastPage.next_page != null ? lastPage.next_page : undefined,
    staleTime: 60_000,
    // Only fire when the user has clicked "Load more" at least once
    enabled: liveEnabled && !useMockData,
  });

  // ── Event list assembly ──────────────────────────────────────────────────
  const overviewEvents = overview.recent_events ?? [];
  const additionalEvents =
    infiniteData?.pages.flatMap((page) => page.events) ?? [];

  const mockEvents = mockExpanded
    ? overviewEvents
    : overviewEvents.slice(0, INITIAL_VISIBLE);

  const liveEvents = [...overviewEvents, ...additionalEvents];

  const events = useMockData ? mockEvents : liveEvents;

  // ── "Load more" visibility ────────────────────────────────────────────────
  const mockHasMore =
    useMockData && !mockExpanded && overviewEvents.length > INITIAL_VISIBLE;

  // In live mode, show the button until we know for certain there are no
  // more pages (i.e., after the first fetch returns hasNextPage === false).
  const liveHasMore =
    !useMockData && (!liveEnabled || (hasNextPage ?? false));

  const showLoadMore = mockHasMore || liveHasMore;
  const isLoadingMore = !useMockData && isFetchingNextPage;

  function handleLoadMore() {
    if (useMockData) {
      setMockExpanded(true);
      return;
    }
    if (!liveEnabled) {
      // First click: enable the query (it immediately fetches page 2)
      setLiveEnabled(true);
    } else {
      // Subsequent clicks: fetch the next page
      fetchNextPage();
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) return <HistorySkeleton />;

  // ── Empty ────────────────────────────────────────────────────────────────
  if (events.length === 0) {
    return (
      <section
        aria-label="Journey history"
        className="animate-fade-in"
        data-testid="history-section"
      >
        <SectionLabel />
        <EmptyState
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
      className="animate-fade-in"
      data-testid="history-section"
    >
      <SectionLabel />

      {/*
       * Single Card wraps all rows.
       * padding="none" so each HistoryEvent controls its own horizontal
       * padding — this lets the separator borders run full-width inside
       * the card without clipping.
       */}
      <Card padding="none" aria-live="polite" aria-relevant="additions">
        {events.map((event, index) => (
          <HistoryEvent
            key={event.id}
            event={event}
            isLast={index === events.length - 1 && !showLoadMore}
          />
        ))}

        {/*
         * Load more button — sits inside the Card so its top border
         * aligns with the last event's bottom separator, creating a
         * seamless extension of the list rather than a detached button.
         */}
        {showLoadMore && (
          <LoadMoreButton
            onClick={handleLoadMore}
            isLoading={isLoadingMore}
          />
        )}
      </Card>
    </section>
  );
}

"use client";

// =============================================================================
// features/journey/components/JourneyPageClient.tsx
//
// Client boundary for the Journey page — fully assembled (Parts 1–3).
//
// Owns:
//   - TanStack Query: GET /api/v1/journey/overview (staleTime: 60s, no polling)
//   - Zustand store hydration via setOverview()
//   - Window-focus invalidation (spec §9: "Invalidate On: Window Refocus")
//   - Keyboard Escape → closeModal()
//   - Section composition in vertical scroll order
//   - Loading / error state routing
//
// Section render order (Journey Page Specification §2):
//   1. JourneyHeader
//   2. RegionOverview
//   3. TimelineSection
//   4. QuarterlyReviewSection
//   5. PassportSection
//   6. HistorySection
//   + Modal portal (Part 4 — RegionDetailModal, ReviewDetailModal, PassportModal)
//
// Query invalidation keys (spec §9 — no polling):
//   Invalidate ['journey', 'overview'] and ['journey', 'history'] on:
//     - region completion
//     - review completion / failure
//     - passport earned
//     - window refocus
//
// Critical failure (journey_prd.md §2):
//   When player_state.critical_failure === true the dashboard is dimmed and
//   XP/challenge progression is frozen. The CriticalFailureOverlay below
//   renders an overlay inside this component's tree; the sections remain
//   visible beneath it so the user can still read their history.
// =============================================================================

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";

import {
  useJourneyStore,
  useActiveModal,
  useModalActions,
  useBootstrapData,
} from "@/components/journey/stores/journeyStore";
import {
  JOURNEY_QUERY_KEYS,
  type JourneyOverview,
  type ApiResponse,
} from "@/components/journey/types/journey.types";
import { cn } from "@/lib/utils";

// ── Section imports ──────────────────────────────────────────────────────────────────
import { JourneyHeader } from "./JourneyHeader";
import { RegionOverview } from "../features/RegionOverview";
import { TimelineSection } from "../features/TimelineSection";
import { QuarterlyReviewSection } from "../features/QuarterlyReviewSection";
import { PassportSection } from "../features/PassportSection";
import { HistorySection } from "../features/HistorySection";
import { JourneyProvider } from "./JourneyContext";
import { MOCK_JOURNEY_OVERVIEW } from "../stores/journeyStore";

// ── Modal import (Part 4) ───────────────────────────────────────────────────────────
import { JourneyModals } from "../modals/JourneyModals";

// ─── API fetcher ──────────────────────────────────────────────────────────────

async function fetchJourneyOverview(): Promise<JourneyOverview> {
  const res = await fetch("/api/v1/journey/overview", {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(
      `Journey overview request failed with status ${res.status}`
    );
  }

  const json: ApiResponse<JourneyOverview> = await res.json();

  if (!json.success) {
    throw new Error(json.error.message);
  }

  return json.data;
}

// ─── Page-level error state ───────────────────────────────────────────────────

interface PageErrorProps {
  onRetry: () => void;
}

function PageError({ onRetry }: PageErrorProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-5 py-24"
      role="alert"
      aria-live="assertive"
    >
      <AlertTriangle
        size={28}
        strokeWidth={2}
        className="text-terracotta"
        aria-hidden="true"
      />
      <p className="font-display text-[15px] font-semibold text-pearl-text">
        Unable to load journey.
      </p>
      <button
        onClick={onRetry}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2",
          "rounded-lg border border-tactical-border",
          "bg-transparent font-sans text-sm text-pearl-text",
          "hover:border-muted-emerald transition-colors duration-200",
          "cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-muted-emerald focus-visible:ring-offset-2",
          "focus-visible:ring-offset-abyssal-slate"
        )}
      >
        <RefreshCw size={13} strokeWidth={2} aria-hidden="true" />
        Retry
      </button>
    </div>
  );
}

// ─── Critical failure overlay ─────────────────────────────────────────────────
// When HP = 0 the page dims and a recovery banner appears.
// The underlying sections remain visible (user can still read history /
// view transactions). XP gain and challenge progression are frozen server-side.
// The "[Review & Revive]" action calls the Financial Audit endpoint (Part 4).

function CriticalFailureOverlay() {
  return (
    <div
      className={cn(
        // Full-page overlay inside the content column
        "absolute inset-0 z-10",
        "flex flex-col items-center",
        "pt-32 px-6",
        // Grayscale dims the underlying sections
        "bg-abyssal-slate/70 backdrop-grayscale"
      )}
      role="alert"
      aria-live="assertive"
      aria-label="Critical failure — financial audit required"
    >
      <div
        className={cn(
          "w-full max-w-sm",
          "rounded-xl border border-terracotta/50",
          "bg-canvas-surface",
          "p-6 text-center",
          "flex flex-col items-center gap-4"
        )}
      >
        <AlertTriangle
          size={28}
          strokeWidth={2}
          className="text-terracotta"
          aria-hidden="true"
        />

        {/* CRITICAL FAILURE heading — exact copy per PRD §5 */}
        <h2 className="font-display text-lg font-semibold uppercase tracking-wider text-terracotta">
          Critical Failure
        </h2>

        {/* Context — exact copy per PRD §5 */}
        <p className="font-sans text-sm text-muted-text">
          Financial Audit Required. Your HP has reached 0. XP gain and
          challenge progression are frozen until you complete an audit.
        </p>

        {/* [Review & Revive] action button — exact label per PRD §5 */}
        <button
          type="button"
          onClick={() => {
            // TODO (Part 4): call Financial Audit endpoint
            // POST /api/v1/journey/financial-audit → restores +10 HP
          }}
          className={cn(
            "w-full rounded-lg px-5 py-2.5",
            "bg-terracotta/10 border border-terracotta/50",
            "font-sans text-sm font-medium text-terracotta",
            "hover:bg-terracotta/20 transition-colors duration-200",
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-terracotta focus-visible:ring-offset-2",
            "focus-visible:ring-offset-canvas-surface"
          )}
        >
          Review &amp; Revive
        </button>

        {/* Allowed actions reminder */}
        <p className="font-sans text-xs text-muted-text/70">
          You can still view your dashboard, transactions, and journey history.
        </p>
      </div>
    </div>
  );
}

// ─── JourneyPageClient ────────────────────────────────────────────────────────

export function JourneyPageClient() {
  const activeModal = useActiveModal();
  const { closeModal } = useModalActions();
  const queryClient = useQueryClient();

  const isMockData = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

  // ── TanStack Query — GET /api/v1/journey/overview ─────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: JOURNEY_QUERY_KEYS.overview(),
    queryFn: fetchJourneyOverview,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    enabled: !isMockData,
  });

  const resolvedData = isMockData ? MOCK_JOURNEY_OVERVIEW : data;

  // ── Keyboard: Escape → closeModal ─────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && activeModal) {
        closeModal();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeModal, closeModal]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading && !resolvedData) {
    return (
      <div
        className="flex flex-col gap-8 animate-pulse py-8"
        aria-label="Loading journey data"
        aria-busy="true"
        role="status"
      >
        {[220, 180, 260, 180, 140].map((h, i) => (
          <div
            key={i}
            className="rounded-xl border border-tactical-border bg-canvas-surface"
            style={{ height: `${h}px` }}
            aria-hidden="true"
          />
        ))}
        <span className="sr-only">Loading journey…</span>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (isError && !resolvedData) {
    return <PageError onRetry={() => refetch()} />;
  }

  // ── Critical failure overlay ──────────────────────────────────────────────
  const bootstrapData = useBootstrapData();
  const isCriticalFailure = bootstrapData?.player_state?.critical_failure === true;

  return (
    <div className="relative flex flex-col gap-8 py-8">
      {/* Critical failure overlay — dims and freezes progression */}
      {isCriticalFailure && <CriticalFailureOverlay />}

      {resolvedData && (
        <JourneyProvider overview={resolvedData}>
          {/* Section 1 — Header (level, XP, HP, path) */}
          <JourneyHeader isLoading={isLoading} />

          {/* Section 2 — Region Overview (current region + progress) */}
          <RegionOverview />

          {/* Section 3 — 12-Month Timeline */}
          <TimelineSection />

          {/* Section 4 — Quarterly Review */}
          <QuarterlyReviewSection />

          {/* Section 5 — Passport Stamps */}
          <PassportSection />

          {/* Section 6 — Journey History (last 30 events) */}
          <HistorySection />

          {/* Modal portal (RegionDetailModal, ReviewDetailModal, PassportDetailModal) */}
          <JourneyModals />
        </JourneyProvider>
      )}
    </div>
  );
}

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

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";

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
import { PassportSection } from "../features/PassportSection";
import { HistorySection } from "../features/HistorySection";
import { JourneyEmptyState } from "./JourneyEmptyState";
import { JourneyProvider } from "./JourneyContext";
import { apiFetchClient } from "@/lib/apiClient.client";

// ── Modal import (Part 4) ───────────────────────────────────────────────────────────
import { JourneyModals } from "../modals/JourneyModals";

// ─── API fetcher ──────────────────────────────────────────────────────────────

async function fetchJourneyOverview(): Promise<JourneyOverview> {
  return await apiFetchClient<JourneyOverview>("journey/overview");
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

function CriticalFailureOverlay({ onReviveSuccess }: { onReviveSuccess: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleRevive() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setApiError(null);

    try {
      await apiFetchClient("journey/revive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_acknowledged: true }),
      });
      onReviveSuccess();
    } catch (err: any) {
      setApiError(err?.message || "Failed to complete audit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

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

        {apiError && (
          <p className="text-xs text-terracotta bg-terracotta/10 px-3 py-2 rounded-md">
            {apiError}
          </p>
        )}

        {/* [Review & Revive] action button — exact label per PRD §5 */}
        <button
          type="button"
          onClick={handleRevive}
          disabled={isSubmitting}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-lg px-5 py-2.5",
            "bg-terracotta/10 border border-terracotta/50",
            "font-sans text-sm font-medium text-terracotta",
            "hover:bg-terracotta/20 transition-colors duration-200",
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-terracotta focus-visible:ring-offset-2",
            "focus-visible:ring-offset-canvas-surface",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={14} strokeWidth={2} />
              <span>Auditing...</span>
            </>
          ) : (
            <span>Review &amp; Revive</span>
          )}
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

  const bootstrapData = useBootstrapData();
  const isCriticalFailure = bootstrapData?.player_state?.critical_failure === true;

  // ── TanStack Query — GET /api/v1/journey/overview ─────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: JOURNEY_QUERY_KEYS.overview(),
    queryFn: fetchJourneyOverview,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

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
  if (isLoading && !data) {
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
  if (isError && !data) {
    return <PageError onRetry={() => refetch()} />;
  }

  // ── Critical failure overlay ──────────────────────────────────────────────

  return (
    <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Critical failure overlay — dims and freezes progression */}
      {isCriticalFailure && <CriticalFailureOverlay onReviveSuccess={() => queryClient.invalidateQueries({ queryKey: ['journey'] })} />}

      {data && (
        <JourneyProvider overview={data}>
          {/* Row 1 — Header (level, XP, HP, path) */}
          <div className="col-span-1 lg:col-span-12">
            <JourneyHeader isLoading={isLoading} />
          </div>

          {data.recent_events.length === 0 && data.passport.stamps.length === 0 ? (
            <JourneyEmptyState />
          ) : (
            <>
              {/* Row 2 — Region Overview (current region + progress) */}
              <div className="col-span-1 lg:col-span-12 flex flex-col">
                <RegionOverview />
              </div>

              {/* Row 3 — 12-Month Timeline */}
              <div className="col-span-1 lg:col-span-12">
                <TimelineSection />
              </div>

              {/* Row 4 — Passport Stamps */}
              <div className="col-span-1 lg:col-span-7 flex flex-col">
                <PassportSection />
              </div>

              {/* Row 4 — Journey History (last 30 events) */}
              <div className="col-span-1 lg:col-span-5 flex flex-col">
                <HistorySection />
              </div>
            </>
          )}

          {/* Modal portal (RegionDetailModal, ReviewDetailModal, PassportDetailModal) */}
          <JourneyModals />
        </JourneyProvider>
      )}
    </div>
  );
}

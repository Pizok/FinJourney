"use client";

// =============================================================================
// features/journey/components/RegionOverview.tsx
//
// Full-width region card — the visual anchor of the Journey page.
//
// Content (per Journey Page Specification §5 — RegionOverview):
//   - Region artwork (SVG, loaded from local registry keyed by region_id)
//   - Region name + narrative description
//   - Day progress bar (progress_days / total_days)
//   - Region Shift countdown pill
//   - "View Details" ghost button → opens RegionDetailModal via store
//
// Asset architecture (assets.md):
//   The backend sends region_id: "quiet_valley".
//   The frontend maps it to a local SVG via REGION_ARTWORK_REGISTRY.
//   This keeps assets out of the API response while remaining renderer-driven.
//   New regions are added to the registry without changing any API contract.
//
// Empty state:
//   When current_region is absent (new account before first transaction):
//   "Your journey begins with your first transaction."
//
// Design rules:
//   - artwork fills the card top edge (padding="none" on Card, overflow-hidden)
//   - no glassmorphism, no gradient overlays on the artwork
//   - description capped at max-w-[58ch] for 70–80 char line length
//   - countdown pill uses dawn-gold (milestone/warning colour)
//   - "View Details" button: ghost style, tactical-border, hover → dawn-gold
//   - no glow on any element
// =============================================================================

import { useCallback } from "react";
import { Timer, ChevronRight, Globe } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { useOverviewData, useModalActions } from "@/components/journey/stores/journeyStore";
import { cn } from "@/lib/utils";

// ─── SVG artwork registry ─────────────────────────────────────────────────────
// Each entry is a React component rendering an inline SVG.
// Rules per assets.md:
//   - frontend loads assets dynamically (no hardcoded imports elsewhere)
//   - all assets have a fallback
//   - support lazy loading (components are defined in this file;
//     a future iteration can lazy-import from separate region art files)

function QuietValleyArtwork() {
  return (
    <svg
      viewBox="0 0 640 200"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full"
      style={{ height: 200, display: "block" }}
      aria-hidden="true"
      role="img"
    >
      {/* Sky */}
      <rect width="640" height="200" fill="#090e1b" />

      {/* Stars — scattered, varying opacity for depth */}
      {(
        [
          [42, 20, 0.55],  [98, 36, 0.4],  [162, 13, 0.6],
          [230, 28, 0.45], [298, 16, 0.5], [368, 33, 0.4],
          [436, 19, 0.55], [510, 38, 0.45],[572, 14, 0.5],
          [70,  56, 0.3],  [200, 46, 0.35],[338, 52, 0.3],
          [476, 60, 0.35], [600, 48, 0.3], [24,  44, 0.25],
          [148, 64, 0.25], [280, 70, 0.2], [412, 66, 0.25],
          [540, 72, 0.2],
        ] as [number, number, number][]
      ).map(([cx, cy, opacity], i) => (
        <circle key={i} cx={cx} cy={cy} r={1} fill="#f8fafc" opacity={opacity} />
      ))}

      {/* Crescent moon — top-right */}
      <circle cx="564" cy="38" r="18" fill="#0d1829" />
      <circle cx="556" cy="33" r="14" fill="#090e1b" />

      {/* Distant mountain ridge */}
      <path
        d="M0 122 L80 72 L148 100 L218 60 L296 92 L374 54 L448 80
           L516 58 L580 76 L640 62 L640 200 L0 200Z"
        fill="#0c1e30"
      />

      {/* Mid hills */}
      <path
        d="M0 145 L100 105 L196 130 L294 88 L392 118 L484 96
           L574 112 L640 94 L640 200 L0 200Z"
        fill="#0e2535"
      />

      {/* Valley floor */}
      <path
        d="M0 164 Q160 152 320 160 Q480 168 640 154 L640 200 L0 200Z"
        fill="#0b2e1e"
      />

      {/* Winding path — dashed, muted-emerald tint */}
      <path
        d="M254 200 Q282 182 298 168 Q314 156 334 166
           Q354 176 370 190 Q380 198 390 200"
        fill="none"
        stroke="#0d9488"
        strokeWidth="1.5"
        strokeDasharray="5 4"
        opacity={0.55}
      />

      {/* Current position marker */}
      <circle cx="314" cy="160" r="5" fill="#0d9488" />
      <circle cx="314" cy="160" r="11" fill="#0d9488" opacity={0.18} />
    </svg>
  );
}

function FallbackArtwork() {
  return (
    <div
      className="w-full bg-abyssal-slate flex items-center justify-center"
      style={{ height: 200 }}
      aria-hidden="true"
    >
      <Globe
        size={40}
        strokeWidth={2}
        className="text-tactical-border"
      />
    </div>
  );
}

/** Maps backend region_id → local SVG component */
const REGION_ARTWORK_REGISTRY: Record<string, React.ComponentType> = {
  quiet_valley: QuietValleyArtwork,
  // iron_plains:   IronPlainsArtwork,   ← add as regions are designed
  // silent_coast:  SilentCoastArtwork,
};

function RegionArtwork({ regionId }: { regionId: string }) {
  const Artwork = REGION_ARTWORK_REGISTRY[regionId];
  return Artwork ? <Artwork /> : <FallbackArtwork />;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RegionOverviewSkeleton() {
  return (
    <Card padding="none" className="overflow-hidden" aria-busy="true">
      {/* Artwork placeholder */}
      <div className="w-full h-[200px] bg-abyssal-slate animate-pulse" />
      {/* Content */}
      <div className="p-6 flex flex-col gap-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex flex-col gap-2">
            <div className="h-3 w-24 rounded bg-canvas-surface animate-pulse" />
            <div className="h-6 w-48 rounded bg-canvas-surface animate-pulse" />
          </div>
          <div className="h-8 w-20 rounded-lg bg-canvas-surface animate-pulse shrink-0" />
        </div>
        <div className="h-4 w-full rounded bg-canvas-surface animate-pulse" />
        <div className="h-4 w-3/4 rounded bg-canvas-surface animate-pulse" />
        <div className="h-[5px] w-full rounded-full bg-abyssal-slate animate-pulse" />
        <div className="h-8 w-48 rounded-lg bg-canvas-surface animate-pulse" />
      </div>
    </Card>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function RegionEmptyState() {
  return (
    <Card padding="lg" className="text-center">
      <Globe
        size={32}
        strokeWidth={2}
        className="text-muted-text mx-auto mb-4"
        aria-hidden="true"
      />
      {/* DESIGN.md: no all-caps body text */}
      <p className="font-sans text-sm text-muted-text max-w-[40ch] mx-auto leading-relaxed">
        Your journey begins with your first transaction.
      </p>
    </Card>
  );
}

// ─── Region shift countdown pill ──────────────────────────────────────────────

function ShiftCountdown({ daysRemaining }: { daysRemaining: number }) {
  const urgent = daysRemaining <= 30;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5",
        "px-3 py-2 rounded-lg",
        "border",
        // Dawn Gold for milestone — Terracotta only if critically urgent (< 7 days)
        urgent && daysRemaining < 7
          ? "bg-terracotta/8 border-terracotta/20"
          : "bg-dawn-gold/8 border-dawn-gold/20"
      )}
    >
      <Timer
        size={12}
        strokeWidth={2}
        className={cn(
          "shrink-0",
          urgent && daysRemaining < 7 ? "text-terracotta" : "text-dawn-gold"
        )}
        aria-hidden="true"
      />
      <span
        className={cn(
          "font-sans text-xs font-medium",
          urgent && daysRemaining < 7 ? "text-terracotta" : "text-dawn-gold"
        )}
      >
        Region Shift in {daysRemaining}{" "}
        {daysRemaining === 1 ? "day" : "days"}
      </span>
    </div>
  );
}

// ─── View Details ghost button ─────────────────────────────────────────────────

interface ViewDetailsButtonProps {
  onClick: () => void;
}

function ViewDetailsButton({ onClick }: ViewDetailsButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        // Ghost style per DESIGN.md §6 "Secondary / Ghost"
        "inline-flex items-center gap-1 shrink-0",
        "px-3 py-1.5 rounded-lg",
        "border border-tactical-border",
        "bg-transparent",
        "font-sans text-[13px] text-pearl-text",
        // Hover: border colour shifts to dawn-gold, no shadow
        "hover:border-dawn-gold/60",
        "transition-colors duration-200",
        "cursor-pointer",
        // Focus ring for keyboard accessibility
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-muted-emerald focus-visible:ring-offset-2",
        "focus-visible:ring-offset-canvas-surface"
      )}
    >
      Details
      <ChevronRight size={13} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface RegionOverviewProps {
  isLoading?: boolean;
}

export function RegionOverview({ isLoading = false }: RegionOverviewProps) {
  const overview = useOverviewData();
  const { openRegionModal } = useModalActions();

  const handleViewDetails = useCallback(() => {
    if (!overview.current_region) return;
    openRegionModal(
      overview.current_region.id,
      overview.current_region
    );
  }, [overview.current_region, openRegionModal]);

  if (isLoading) return <RegionOverviewSkeleton />;
  if (!overview.current_region) return <RegionEmptyState />;

  const region = overview.current_region;

  /*
   * Progress percentage — presentation division of two server integers.
   * The backend owns all region completion logic; this is display-only.
   */
  const progressPct =
    region.total_days > 0
      ? Math.min(100, Math.round((region.progress_days / region.total_days) * 100))
      : 0;

  return (
    <Card
      padding="none"
      className="overflow-hidden animate-fade-in"
      data-testid="region-overview"
    >
      {/* ── Artwork — full-bleed, no overlay ───────────────────────────── */}
      <RegionArtwork regionId={region.id} />

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="p-6 flex flex-col gap-4">

        {/* ── Header row: name + details button ──────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            {/* Section eyebrow label */}
            <p
              className={[
                "font-sans text-[11px] font-semibold uppercase tracking-[0.1em]",
                "text-muted-emerald mb-1",
              ].join(" ")}
            >
              Current Region
            </p>
            {/* Region name — h2 (h1 is "The Journey" in JourneyHeader) */}
            <h2
              className={[
                "font-display text-[20px] font-semibold",
                "text-pearl-text tracking-[-0.01em] leading-tight",
              ].join(" ")}
            >
              {region.name}
            </h2>
          </div>
          <ViewDetailsButton onClick={handleViewDetails} />
        </div>

        {/* ── Description ─────────────────────────────────────────────── */}
        {region.description && (
          /*
           * max-w-[58ch] keeps the line length within the 70–80 char
           * target from DESIGN.md §2 even on wide viewports.
           */
          <p className="font-sans text-[13px] text-muted-text leading-[1.65] max-w-[58ch]">
            {region.description}
          </p>
        )}

        {/* ── Progress bar ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="font-sans text-[12px] text-muted-text">
              Day {region.progress_days} of {region.total_days}
            </span>
            <span className="font-sans text-[12px] font-medium text-pearl-text tabular-nums">
              {progressPct}%
            </span>
          </div>
          <Progress
            value={region.progress_days}
            max={region.total_days}
            colorVar="--color-muted-emerald"
            height="sm"
            aria-label={`Region progress: day ${region.progress_days} of ${region.total_days}`}
          />
        </div>

        {/* ── Region shift countdown ───────────────────────────────────── */}
        <ShiftCountdown daysRemaining={region.days_remaining} />
      </div>
    </Card>
  );
}

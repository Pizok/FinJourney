"use client";

// =============================================================================
// features/journey/modals/RegionDetailModal.tsx
//
// Drill-down modal for a region — opened by clicking "Details" in RegionOverview.
//
// Content (Journey Page Specification §3.2 — Region Exploration Flow):
//   - Full-width region artwork (from the shared RegionArtwork registry)
//   - Current Region eyebrow label + h2 region name
//   - Narrative description
//   - Stats grid: Days Spent · Days Remaining · Total Duration · Progress
//   - Milestones earned (when detail data resolves)
//   - Date entered (when detail data resolves)
//   - Region Shift countdown pill
//
// Data:
//   useRegionDetail({ regionId, summary }) — placeholderData from the overview
//   summary means the modal renders immediately without a blank state.
//   The extra fields (entered_at, milestones_earned) appear once the network
//   request resolves, fading in without layout shift.
//
// States:
//   placeholder data → renders with summary fields; detail rows show "—"
//   full data loaded  → all rows populated
//   fetch error       → ModalErrorBody with retry action inside the scrollable body
//
// Accessibility:
//   Modal.tsx handles focus trap, Escape, aria-modal, and aria-labelledby.
//   The visible h2 inside Modal.Header is wrapped in the aria-labelledby target.
// =============================================================================

import { Timer } from "lucide-react";
import { Modal, ModalLoadingBody, ModalErrorBody } from "@/components/ui/Modal";
import { Progress } from "@/components/ui/Progress";
import { cn } from "@/lib/utils";
import { RegionArtwork } from "@/features/journey/artwork/RegionArtwork";
import {
  useRegionDetail,
  type RegionDetailData,
} from "@/features/journey/hooks/useRegionDetail";
import type { CurrentRegion } from "@/components/journey/types/journey.types";

// ─── Stat tile ────────────────────────────────────────────────────────────────

interface StatTileProps {
  label: string;
  value: string | number | undefined;
  /** Applies dawn-gold colouring — used for the progress % */
  highlight?: boolean;
}

function StatTile({ label, value, highlight = false }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg bg-abyssal-slate border border-tactical-border/60">
      <span className="font-sans text-[11px] text-muted-text uppercase tracking-[0.08em] font-semibold">
        {label}
      </span>
      <span
        className={cn(
          "font-display text-[18px] font-semibold leading-none tabular-nums",
          highlight ? "text-dawn-gold" : "text-pearl-text"
        )}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

// ─── Detail row ───────────────────────────────────────────────────────────────
// Used for the entered_at / milestones_earned fields that arrive after the
// initial placeholder render.

interface DetailRowProps {
  label: string;
  value: string | number | undefined;
  isLast?: boolean;
}

function DetailRow({ label, value, isLast = false }: DetailRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-3",
        !isLast && "border-b border-tactical-border"
      )}
    >
      <span className="font-sans text-[13px] text-muted-text">{label}</span>
      <span className="font-sans text-[13px] font-medium text-pearl-text">
        {value ?? "—"}
      </span>
    </div>
  );
}

// ─── Modal content ────────────────────────────────────────────────────────────

interface RegionDetailContentProps {
  data: RegionDetailData;
  isPlaceholder: boolean;
}

function RegionDetailContent({
  data,
  isPlaceholder,
}: RegionDetailContentProps) {
  const progressPct =
    data.total_days > 0
      ? Math.min(100, Math.round((data.progress_days / data.total_days) * 100))
      : 0;

  const urgent = data.days_remaining <= 30;

  // Format entered_at ISO date to a readable label, e.g. "March 6, 2026"
  const enteredLabel = data.entered_at
    ? new Date(data.entered_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : undefined;

  return (
    <>
      {/* ── Region artwork — full-bleed inside Modal.Body ──────────── */}
      {/*
       * The artwork sits above the inner content padding.
       * We use negative margin to bleed it to the Modal.Body edges,
       * then restore the padding below it.
       */}
      <div className="-mx-6 -mt-5 mb-5 overflow-hidden rounded-t-none">
        <RegionArtwork regionId={data.id} />
      </div>

      {/* ── Eyebrow + name ─────────────────────────────────────────── */}
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-emerald mb-1">
        Current Region
      </p>

      {/* ── Stats grid ─────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-2 gap-2 mb-5"
        aria-label="Region statistics"
      >
        <StatTile label="Days Spent" value={data.progress_days} />
        <StatTile label="Days Remaining" value={data.days_remaining} />
        <StatTile label="Total Duration" value={`${data.total_days} days`} />
        <StatTile label="Progress" value={`${progressPct}%`} highlight />
      </div>

      {/* ── Progress bar ───────────────────────────────────────────── */}
      <div className="mb-5">
        <Progress
          value={data.progress_days}
          max={data.total_days}
          colorVar="--color-muted-emerald"
          height="sm"
          aria-label={`Region cycle progress: ${progressPct}%`}
        />
      </div>

      {/* ── Description ────────────────────────────────────────────── */}
      {data.description && (
        <p className="font-sans text-[13px] text-muted-text leading-[1.7] mb-5 max-w-[58ch]">
          {data.description}
        </p>
      )}

      {/* ── Extra detail rows (appear once full data loads) ─────────── */}
      {!isPlaceholder && (
        <div className="mb-5">
          <DetailRow label="Date entered" value={enteredLabel} />
          <DetailRow
            label="Milestones earned"
            value={data.milestones_earned}
            isLast
          />
        </div>
      )}

      {/* ── Region Shift countdown ──────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-3 py-2.5 rounded-lg border",
          urgent && data.days_remaining < 7
            ? "bg-terracotta/8 border-terracotta/22"
            : "bg-dawn-gold/8 border-dawn-gold/22"
        )}
      >
        <Timer
          size={12}
          strokeWidth={2}
          className={cn(
            "shrink-0",
            urgent && data.days_remaining < 7
              ? "text-terracotta"
              : "text-dawn-gold"
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            "font-sans text-[12px] font-medium",
            urgent && data.days_remaining < 7
              ? "text-terracotta"
              : "text-dawn-gold"
          )}
        >
          Region Shift in {data.days_remaining}{" "}
          {data.days_remaining === 1 ? "day" : "days"}
        </span>
      </div>
    </>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  regionId: string;
  /** Optimistic summary from the overview — prevents blank modal flash */
  summary: CurrentRegion;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RegionDetailModal({
  isOpen,
  onClose,
  regionId,
  summary,
}: RegionDetailModalProps) {
  const { data, isLoading, isError, refetch, isPlaceholderData } =
    useRegionDetail({ regionId, summary });

  // Use the summary name in the header immediately — never blank
  const displayName = data?.name ?? summary.name;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={displayName} size="md">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <Modal.Header>
        <h2
          className={[
            "font-display text-[19px] font-semibold",
            "text-pearl-text tracking-[-0.01em] leading-tight",
          ].join(" ")}
        >
          {displayName}
        </h2>
      </Modal.Header>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <Modal.Body>
        {/* Loading with no placeholder (rare — only if opened with no summary) */}
        {isLoading && !data ? (
          <ModalLoadingBody rows={5} />
        ) : isError ? (
          <ModalErrorBody onRetry={refetch} />
        ) : data ? (
          <RegionDetailContent
            data={data}
            isPlaceholder={isPlaceholderData}
          />
        ) : null}
      </Modal.Body>
    </Modal>
  );
}

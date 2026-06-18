"use client";

// =============================================================================
// features/journey/modals/PassportDetailModal.tsx
//
// Drill-down modal for a passport stamp — opened by tapping an EarnedStamp.
//
// Content (Journey Page Specification §3.4 — Passport Flow):
//   - Decorative stamp centrepiece (Award icon in a bordered container)
//   - Region name (h2 inside the stamp visual)
//   - Date earned
//   - Detail rows: Region · Date Earned · Related Challenge · Status
//   - Historical snapshot note (when available)
//
// Data source:
//   Unlike the Region and Review modals, passport stamps are fully loaded
//   from the overview payload — no secondary API fetch is needed.
//   The stamp data is passed directly as a prop.
//
// Accessibility:
//   Modal.tsx handles focus trap, Escape, aria-modal, and aria-labelledby.
//   The stamp visual container is aria-hidden (decorative).
//   The detail rows use a description list (dl/dt/dd) for proper semantics.
//
// Design rules (DESIGN.md):
//   - Stamp centrepiece: 2px dashed tactical-border container, rounded-xl
//   - Award icon: steel-violet for completed, muted-emerald for active
//   - Detail rows: border-b tactical-border between rows, no border on last
//   - Status value rendered as a StatusBadge for visual consistency
//   - No hardcoded hex values
// =============================================================================

import { Award } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { PassportStamp } from "@/components/journey/types/journey.types";

// ─── Stamp centrepiece ────────────────────────────────────────────────────────

function StampCentrepiece({ stamp }: { stamp: PassportStamp }) {
  const isActive = stamp.type === "active";
  const accentColor = isActive ? "muted-emerald" : "steel-violet";

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3",
        "px-6 py-7 mx-0 mb-5",
        "rounded-xl border-2 border-dashed border-tactical-border/60"
      )}
      aria-hidden="true"  // decorative — the detail rows convey the same info
    >
      {/* Icon container */}
      <div
        className={cn(
          "flex items-center justify-center",
          "w-14 h-14 rounded-xl",
          accentColor === "muted-emerald"
            ? "bg-muted-emerald/12 border border-muted-emerald/25"
            : "bg-steel-violet/12 border border-steel-violet/25"
        )}
      >
        <Award
          size={28}
          strokeWidth={2}
          className={
            accentColor === "muted-emerald"
              ? "text-muted-emerald"
              : "text-steel-violet"
          }
        />
      </div>

      {/* Region name inside the stamp */}
      <div className="text-center">
        <p
          className={cn(
            "font-display text-[18px] font-semibold",
            "text-pearl-text tracking-[-0.01em] leading-tight mb-1"
          )}
        >
          {stamp.region}
        </p>
        <p className="font-sans text-[12px] text-muted-text">{stamp.date}</p>
      </div>

      {/* Status pip */}
      <div
        className={cn(
          "h-[3px] w-8 rounded-full",
          isActive ? "bg-muted-emerald/50" : "bg-steel-violet/50"
        )}
      />
    </div>
  );
}

// ─── Detail list ──────────────────────────────────────────────────────────────
// Semantically correct dl/dt/dd structure for key-value metadata.

interface DetailListItem {
  term: string;
  detail: React.ReactNode;
}

interface DetailListProps {
  items: DetailListItem[];
}

function DetailList({ items }: DetailListProps) {
  return (
    <dl aria-label="Stamp details" className="flex flex-col">
      {items.map(({ term, detail }, i) => (
        <div
          key={term}
          className={cn(
            "flex items-center justify-between gap-4 py-3",
            i < items.length - 1 && "border-b border-tactical-border"
          )}
        >
          <dt className="font-sans text-[13px] text-muted-text shrink-0">
            {term}
          </dt>
          <dd className="font-sans text-[13px] font-medium text-pearl-text text-right m-0">
            {detail}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PassportDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  stamp: PassportStamp;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PassportDetailModal({
  isOpen,
  onClose,
  stamp,
}: PassportDetailModalProps) {
  const statusLabel = stamp.type === "active" ? "active" : "completed";

  const detailItems: { term: string; detail: React.ReactNode }[] = [
    { term: "Region", detail: stamp.region },
    { term: "Date earned", detail: stamp.date },
    { term: "Related challenge", detail: stamp.challenge },
    {
      term: "Status",
      detail: <StatusBadge status={statusLabel} />,
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Passport stamp: ${stamp.region}`}
      size="sm"
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <Modal.Header>
        <h2
          className={[
            "font-display text-[19px] font-semibold",
            "text-pearl-text tracking-[-0.01em] leading-tight",
          ].join(" ")}
        >
          Passport Stamp
        </h2>
      </Modal.Header>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <Modal.Body>
        {/* Collectible visual */}
        <StampCentrepiece stamp={stamp} />

        {/* Metadata rows */}
        <DetailList items={detailItems} />

        {/* Historical context note — rendered for completed stamps */}
        {stamp.type === "completed" && (
          <p
            className={cn(
              "mt-4 font-sans text-[12px] text-muted-text/70",
              "leading-relaxed italic"
            )}
          >
            This stamp marks the completion of the {stamp.region} chapter in
            your financial story.
          </p>
        )}
      </Modal.Body>
    </Modal>
  );
}

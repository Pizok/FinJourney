"use client";

// =============================================================================
// features/journey/components/TimelineSection.tsx
//
// Visual representation of the 365-day region cycle as a horizontal node path.
//
// Content (per Journey Page Specification §5 — TimelineSection):
//   - Horizontally scrollable track with CSS scroll-snapping
//   - Milestone nodes at days: 30, 60, 90, 120, 150, 180, 210, 240, 270,
//     300, 330, 365
//   - A "Today" diamond node injected at the exact account_days position
//   - Quarterly review markers at days 90 (Q1), 180 (Q2), 270 (Q3)
//   - Year-end node at day 365 (Region Shift destination)
//   - Connector lines between each node (muted-emerald when completed)
//   - Legend row: Completed · Review · Year End
//
// Auto-scroll:
//   On mount, the track scrolls so the "Today" node is centred in the
//   visible viewport. Uses a ref + scrollLeft calculation after paint.
//
// Mobile (DESIGN.md §11):
//   The track uses overflow-x: auto + scroll-snap-type: x proximity.
//   The Today node snaps to centre on mobile. Touch-friendly (WebkitOverflow).
//
// Empty state:
//   If journey_progress is absent: "No milestones yet."
//
// Node type resolution:
//   day <= account_days                    → completed / quarterly_done
//   day === injected today position        → today
//   first quarterly day > account_days    → quarterly_upcoming
//   365                                   → year_end
//   all other future days                 → future
//
// Backend authority:
//   account_days is a server value. No progression logic is derived here —
//   only presentation layout (which milestone visual state to render).
// =============================================================================

import { useRef, useEffect, useMemo } from "react";
import { Route } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { RegionNode, type RegionNodeData, type RegionNodeType } from "./RegionNode";
import { useJourneyData } from "../layout/JourneyContext";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Fixed milestone days in the 365-day cycle */
const MILESTONE_DAYS = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 365] as const;

/** Quarterly review days */
const QUARTERLY_DAYS = new Set([90, 180, 270]);

// ─── Timeline builder ────────────────────────────────────────────────────────

function buildTimelineNodes(accountDays: number): RegionNodeData[] {
  const nodes: RegionNodeData[] = [];
  let todayInserted = false;

  for (const day of MILESTONE_DAYS) {
    // Insert the "Today" diamond before the first milestone that exceeds
    // the current account day (but only if account_days isn't exactly on
    // a milestone — in that case the milestone itself becomes 'today').
    if (!todayInserted && day > accountDays) {
      nodes.push({
        day: accountDays,
        label: "Today",
        nodeType: "today",
      });
      todayInserted = true;
    }

    const isYearEnd = day === 365;
    const isQuarterly = QUARTERLY_DAYS.has(day);
    const isCompleted = day <= accountDays;

    let nodeType: RegionNodeType;

    if (isYearEnd) {
      nodeType = "year_end";
    } else if (isQuarterly && isCompleted) {
      nodeType = "quarterly_done";
    } else if (isQuarterly && !isCompleted) {
      nodeType = "quarterly_upcoming";
    } else if (isCompleted) {
      // Check whether this exact milestone IS the current day
      nodeType = day === accountDays ? "today" : "completed";
    } else {
      nodeType = "future";
    }

    // Don't insert a separate "today" node if accountDays lands exactly
    // on this milestone (handled above with nodeType = "today")
    if (day === accountDays) todayInserted = true;

    const label = isYearEnd
      ? "Year End"
      : isQuarterly
      ? `Q${[...QUARTERLY_DAYS].indexOf(day) + 1}`
      : `D${day}`;

    nodes.push({ day, label, nodeType });
  }

  // Edge case: accountDays exceeds all milestones (shouldn't happen in v1
  // since the cycle resets at 365, but guard for data integrity)
  if (!todayInserted) {
    nodes.push({ day: accountDays, label: "Today", nodeType: "today" });
  }

  return nodes;
}

/** Returns true if the segment from this node to the next is "completed" */
function isSegmentCompleted(nodeType: RegionNodeType): boolean {
  return (
    nodeType === "completed" ||
    nodeType === "quarterly_done" ||
    nodeType === "today"
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

interface LegendDotProps {
  colorClass: string;
  label: string;
}

function LegendDot({ colorClass, label }: LegendDotProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("w-2 h-2 rounded-full shrink-0", colorClass)} />
      <span className="font-sans text-[11px] text-muted-text">{label}</span>
    </div>
  );
}

function TimelineLegend() {
  return (
    <div
      className="flex items-center gap-4 flex-wrap"
      aria-label="Timeline legend"
    >
      <LegendDot colorClass="bg-muted-emerald" label="Completed" />
      <LegendDot colorClass="bg-dawn-gold" label="Review" />
      <LegendDot colorClass="bg-steel-violet" label="Year End" />
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <Card padding="md" aria-busy="true">
      <div className="flex flex-col gap-5">
        {/* Header row */}
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div className="flex flex-col gap-2">
            <div className="h-3 w-36 rounded bg-abyssal-slate animate-pulse" />
            <div className="h-4 w-48 rounded bg-abyssal-slate animate-pulse" />
          </div>
          {/* Legend skeleton */}
          <div className="flex gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-3 w-20 rounded bg-abyssal-slate animate-pulse"
              />
            ))}
          </div>
        </div>
        {/* Track skeleton */}
        <div className="h-14 rounded bg-abyssal-slate animate-pulse" />
      </div>
    </Card>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function TimelineEmptyState() {
  return (
    <Card padding="lg" className="text-center">
      <Route
        size={28}
        strokeWidth={2}
        className="text-muted-text mx-auto mb-3"
        aria-hidden="true"
      />
      <p className="font-sans text-sm text-muted-text">No milestones yet.</p>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TimelineSection() {
  const overview = useJourneyData();
  const scrollRef = useRef<HTMLDivElement>(null);

  const accountDays = overview.journey_progress?.account_days ?? 0;

  // Build the node array — memoised since accountDays only changes on
  // snapshot events (once per day at 00:00 local timezone)
  const nodes = useMemo(
    () => (accountDays > 0 ? buildTimelineNodes(accountDays) : []),
    [accountDays]
  );

  // ── Auto-scroll to today node ──────────────────────────────────────────────
  // After the first paint, scroll the track so the "Today" diamond sits
  // roughly centred. We find the index of the today node, estimate its
  // x-offset from the left (each node + connector ≈ 56px), and scroll to
  // (offset - container.width / 2) so it appears centred.
  useEffect(() => {
    if (!scrollRef.current || nodes.length === 0) return;

    const todayIndex = nodes.findIndex((n) => n.nodeType === "today");
    if (todayIndex < 0) return;

    // Approximate: each node cell is ~56px (28px min-width + 28px connector).
    // This is a best-effort estimate — the exact value depends on node type
    // min-widths, but it's close enough for the initial scroll position.
    const NODE_WIDTH_APPROX = 56;
    const estimatedOffset = todayIndex * NODE_WIDTH_APPROX;
    const containerWidth = scrollRef.current.clientWidth;

    scrollRef.current.scrollLeft = Math.max(
      0,
      estimatedOffset - containerWidth / 2
    );
  }, [nodes]);


  if (!overview.journey_progress || accountDays === 0) return <TimelineEmptyState />;

  /*
   * Cycle percentage — display-only presentation of server data.
   * Used in the section subtitle only; not a gate or unlock decision.
   */
  const cyclePct = Math.min(
    100,
    Math.round((accountDays / 365) * 100)
  );

  return (
    <Card
      padding="md"
      className="animate-fade-in"
      data-testid="timeline-section"
    >
      {/* ── Section header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          {/* Section label — DESIGN.md uppercase label style */}
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-text mb-1">
            Journey Timeline
          </p>
          <p className="font-sans text-[13px] text-muted-text">
            365-day cycle&nbsp;
            <span className="text-pearl-text/60" aria-hidden="true">
              &middot;
            </span>
            &nbsp;Day {accountDays}&nbsp;
            <span className="text-pearl-text/60" aria-hidden="true">
              &middot;
            </span>
            &nbsp;{cyclePct}% complete
          </p>
        </div>
        <TimelineLegend />
      </div>

      {/* ── Scrollable track ─────────────────────────────────────────────── */}
      {/*
       * overflow-x: auto   — enables horizontal scroll on small screens
       * scroll-snap-type   — proximity snapping keeps nodes legible on mobile
       * scrollbar styling  — thin scrollbar, canvas-surface colour
       * pb-2               — breathing room below the node labels
       */}
      <div
        ref={scrollRef}
        role="list"
        aria-label={`Journey timeline, Day ${accountDays} of 365`}
        className={cn(
          "flex items-center",
          "overflow-x-auto",
          "pb-3",
          // Scroll snap: proximity so nodes don't aggressively jump
          "[scroll-snap-type:x_proximity]",
          // Custom scrollbar — thin, palette-matched
          "scrollbar-thin",
          "[&::-webkit-scrollbar]:h-[3px]",
          "[&::-webkit-scrollbar-track]:bg-transparent",
          "[&::-webkit-scrollbar-thumb]:bg-tactical-border",
          "[&::-webkit-scrollbar-thumb]:rounded-full",
          // iOS momentum scrolling
          "[-webkit-overflow-scrolling:touch]"
        )}
      >
        {nodes.map((node, index) => {
          const isLast = index === nodes.length - 1;
          const showConnector = !isLast;
          const connectorCompleted = isSegmentCompleted(node.nodeType);

          return (
            <RegionNode
              key={`${node.nodeType}-${node.day}`}
              day={node.day}
              label={node.label}
              nodeType={node.nodeType}
              showConnector={showConnector}
              connectorCompleted={connectorCompleted}
            />
          );
        })}
      </div>

      {/* ── Keyboard scroll hint (screen-reader only) ────────────────────── */}
      <p className="sr-only">
        Use arrow keys or swipe to explore the timeline. Today is Day{" "}
        {accountDays}.
      </p>
    </Card>
  );
}

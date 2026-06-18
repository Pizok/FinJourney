"use client";

// =============================================================================
// features/journey/components/RegionNode.tsx
//
// Atomic node element in the Journey Timeline.
//
// Each node represents a milestone day on the 365-day cycle.
// TimelineSection assembles an array of RegionNodeData and renders
// one RegionNode per milestone, separated by connector lines.
//
// Node types (visual states):
//   completed          → filled muted-emerald circle
//   quarterly_done     → filled muted-emerald circle + star icon
//   today              → filled muted-emerald diamond + pulse ring (current position)
//   quarterly_upcoming → outline dawn-gold circle + star outline
//   year_end           → filled steel-violet rounded square + flag icon
//   future             → outline tactical-border circle
//
// Connector lines:
//   The horizontal line joining two nodes is rendered by this component as an
//   optional right-side appendage (showConnector prop). This keeps connector
//   state co-located with the node that "owns" the segment to its right.
//
// Design rules:
//   - No hardcoded hex values
//   - Pulse ring on 'today' node uses ring colour from CSS variables
//   - Labels: IBM Plex Sans, 9px, muted-text — smallest text on the page
//   - Year-end node is visually distinct (28px square vs 18px circle)
// =============================================================================

import { Flag, Star } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RegionNodeType =
  | "completed"
  | "quarterly_done"
  | "today"
  | "quarterly_upcoming"
  | "year_end"
  | "future";

export interface RegionNodeData {
  /** The milestone day this node represents (e.g., 30, 90, 273, 365) */
  day: number;
  /** Short label rendered below the node (e.g., "Q1", "D90", "Today", "Year End") */
  label: string;
  /** Visual/semantic state */
  nodeType: RegionNodeType;
}

export interface RegionNodeProps extends RegionNodeData {
  /**
   * When true, a horizontal connector line is rendered to the right of this node.
   * Pass false for the last node in the timeline.
   */
  showConnector?: boolean;
  /**
   * Whether the connector line to the right of this node represents a
   * completed segment. Completed connectors render in muted-emerald;
   * future connectors render in tactical-border at reduced opacity.
   */
  connectorCompleted?: boolean;
}

// ─── Node geometry config ─────────────────────────────────────────────────────

interface NodeConfig {
  /** Outer container min-width to prevent label overflow */
  containerWidth: string;
  /** Circle/shape size (Tailwind w/h class) */
  size: string;
  /** Border radius class */
  shape: string;
  /** Filled vs outlined */
  filled: boolean;
  /** Tailwind colour classes for filled state */
  filledColor: string;
  /** Tailwind border colour for unfilled state */
  outlineColor: string;
  /** Whether to show the pulse ring (today only) */
  pulse: boolean;
}

const NODE_CONFIG: Record<RegionNodeType, NodeConfig> = {
  completed: {
    containerWidth: "min-w-[28px]",
    size: "w-[18px] h-[18px]",
    shape: "rounded-full",
    filled: true,
    filledColor: "bg-muted-emerald border-muted-emerald",
    outlineColor: "border-muted-emerald",
    pulse: false,
  },
  quarterly_done: {
    containerWidth: "min-w-[32px]",
    size: "w-[22px] h-[22px]",
    shape: "rounded-full",
    filled: true,
    filledColor: "bg-muted-emerald border-muted-emerald",
    outlineColor: "border-muted-emerald",
    pulse: false,
  },
  today: {
    containerWidth: "min-w-[36px]",
    size: "w-[20px] h-[20px]",
    // Rotated square = diamond
    shape: "rounded-[4px] rotate-45",
    filled: true,
    filledColor: "bg-muted-emerald border-muted-emerald",
    outlineColor: "border-muted-emerald",
    pulse: true,
  },
  quarterly_upcoming: {
    containerWidth: "min-w-[32px]",
    size: "w-[22px] h-[22px]",
    shape: "rounded-full",
    filled: false,
    filledColor: "bg-dawn-gold border-dawn-gold",
    outlineColor: "border-dawn-gold",
    pulse: false,
  },
  year_end: {
    containerWidth: "min-w-[44px]",
    size: "w-[28px] h-[28px]",
    shape: "rounded-[6px]",
    filled: true,
    filledColor: "bg-steel-violet border-steel-violet",
    outlineColor: "border-steel-violet",
    pulse: false,
  },
  future: {
    containerWidth: "min-w-[28px]",
    size: "w-[18px] h-[18px]",
    shape: "rounded-full",
    filled: false,
    filledColor: "bg-tactical-border border-tactical-border",
    outlineColor: "border-tactical-border",
    pulse: false,
  },
};

// ─── Node icon ────────────────────────────────────────────────────────────────

function NodeIcon({ nodeType }: { nodeType: RegionNodeType }) {
  switch (nodeType) {
    case "year_end":
      return (
        <Flag
          size={12}
          strokeWidth={2}
          className="text-pearl-text shrink-0"
          aria-hidden="true"
        />
      );
    case "quarterly_done":
      return (
        <Star
          size={9}
          strokeWidth={2}
          // Filled star for completed quarterly nodes
          className="text-abyssal-slate shrink-0"
          fill="currentColor"
          aria-hidden="true"
        />
      );
    case "quarterly_upcoming":
      return (
        <Star
          size={9}
          strokeWidth={2}
          className="text-dawn-gold shrink-0"
          aria-hidden="true"
        />
      );
    default:
      return null;
  }
}

// ─── Pulse ring (today node only) ────────────────────────────────────────────
// A softly expanding ring that draws the eye to the current position
// without using glow or shadow — stays within the "flat surfaces" rule.

function PulseRing() {
  return (
    <span
      className="absolute inset-0 rounded-[4px] rotate-45 animate-ping opacity-25 bg-muted-emerald"
      aria-hidden="true"
    />
  );
}

// ─── Connector ────────────────────────────────────────────────────────────────

interface ConnectorProps {
  completed: boolean;
}

function Connector({ completed }: ConnectorProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "w-7 h-[2px] shrink-0",
        completed ? "bg-muted-emerald opacity-60" : "bg-tactical-border opacity-30"
      )}
    />
  );
}

// ─── RegionNode ───────────────────────────────────────────────────────────────

export function RegionNode({
  day,
  label,
  nodeType,
  showConnector = false,
  connectorCompleted = false,
}: RegionNodeProps) {
  const config = NODE_CONFIG[nodeType];

  const isCompleted =
    nodeType === "completed" ||
    nodeType === "quarterly_done" ||
    nodeType === "today";

  // For accessibility: provide a meaningful label
  const ariaLabel = [
    `Day ${day}`,
    label !== `D${day}` ? label : "",
    nodeType === "today" ? "current position" : isCompleted ? "completed" : "upcoming",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="flex items-center"
      role="listitem"
    >
      {/* ── Node + label column ─────────────────────────────────────────── */}
      <div
        className={cn(
          "flex flex-col items-center gap-[5px]",
          "shrink-0",
          config.containerWidth
        )}
        aria-label={ariaLabel}
      >
        {/* ── Shape ───────────────────────────────────────────────────── */}
        <div className="relative flex items-center justify-center">
          {/* Pulse ring — today node only */}
          {config.pulse && <PulseRing />}

          <div
            className={cn(
              "relative flex items-center justify-center",
              "border-2",
              config.size,
              config.shape,
              config.filled ? config.filledColor : `border-${config.outlineColor} bg-transparent`,
              // When the node is an outlined type, use the outline colour
              !config.filled && config.outlineColor,
            )}
          >
            <NodeIcon nodeType={nodeType} />
          </div>
        </div>

        {/* ── Label ───────────────────────────────────────────────────── */}
        <span
          className={cn(
            "font-sans text-[9px] whitespace-nowrap text-muted-text leading-none",
            // Today and year-end labels get slightly more weight for legibility
            (nodeType === "today" || nodeType === "year_end") &&
              "font-semibold text-pearl-text/70"
          )}
        >
          {label}
        </span>
      </div>

      {/* ── Right-side connector ──────────────────────────────────────── */}
      {showConnector && <Connector completed={connectorCompleted} />}
    </div>
  );
}

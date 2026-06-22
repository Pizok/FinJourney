"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Lock, MapPin, Crown, Star } from "lucide-react";

// ─── Data ────────────────────────────────────────────────────────────────────
// Coordinates are % of container width/height, matching the map image layout:
// Island (bottom-left) → Right mainland swamp/forest → Mountain (right) →
// Left mainland & bridge (mid-left) → Castle/Kingdom (top-center)

export const MAP_NODES = [
  // ── Region 1 — The Island (bottom-left tropical starting zone) ───────────
  { id: "1-1", region: 1, label: "The Wreck",        story: "You crawled ashore from the wreckage. Everything starts here, with nothing but will.",                        x: 12, y: 80 },
  { id: "1-2", region: 1, label: "Driftwood Camp",   story: "A fire, a shelter, a plan. The first night alone teaches you what truly matters.",                            x: 17, y: 75 },
  { id: "1-3", region: 1, label: "Palm Cove",         story: "You found fresh water and shade. Small wins compound into survival.",                                         x: 22, y: 80 },
  { id: "1-4", region: 1, label: "The Old Hut",       story: "Someone lived here before. Their tools, their mistakes — yours to inherit.",                                  x: 15, y: 70 },
  { id: "1-5", region: 1, label: "Tide's Edge",       story: "The sea gives and takes. You learn to read the rhythm before acting.",                                        x: 20, y: 74 },
  { id: "1-6", region: 1, label: "The Dock",          story: "A vessel waits. You've gathered enough to leave. The mainland calls.",                                        x: 27, y: 76 },

  // ── Region 2 — The Swamp & Dark Forest (bottom-right mainland) ───────────
  { id: "2-1", region: 2, label: "Bogwater Landing",  story: "The mainland smells of rot and rain. Every step forward costs something.",                                    x: 55, y: 82 },
  { id: "2-2", region: 2, label: "The Sunken Road",   story: "The path is swallowed by murk. You must feel your way through.",                                              x: 62, y: 78 },
  { id: "2-3", region: 2, label: "Thornwall",         story: "Dense and unforgiving. The forest tests your patience before your strength.",                                 x: 68, y: 74 },
  { id: "2-4", region: 2, label: "The Rotwood",       story: "Trees that look solid crumble at the touch. Trust nothing that hasn't been tested.",                          x: 72, y: 68 },
  { id: "2-5", region: 2, label: "Ember Clearing",    story: "A burned-out camp. Someone tried and failed here. You will not repeat their story.",                          x: 78, y: 72 },
  { id: "2-6", region: 2, label: "The Lumber Posts",  story: "Rough work, real progress. You build calluses and clarity in equal measure.",                                 x: 75, y: 65 },
  { id: "2-7", region: 2, label: "Stonefoot",         story: "The trees thin. Rock replaces mud. The mountain is no longer a rumor.",                                       x: 80, y: 60 },

  // ── Region 3 — The Mountain (right side, caves to summit) ────────────────
  { id: "3-1", region: 3, label: "The Ascent",        story: "The first real climb. Your lungs burn but your vision clears.",                                               x: 83, y: 52 },
  { id: "3-2", region: 3, label: "Cave of Echoes",    story: "The left tunnel. Voices of doubt bounce off every wall. You pass through anyway.",                            x: 78, y: 46 },
  { id: "3-3", region: 3, label: "The Deep Vein",     story: "The right tunnel. Something valuable runs through this rock. You learn to mine it.",                          x: 85, y: 42 },
  { id: "3-4", region: 3, label: "Greyspine Ridge",   story: "Exposed on the cliff face. One wrong step costs everything. Precision now.",                                  x: 80, y: 34 },
  { id: "3-5", region: 3, label: "The Whiteout",      story: "Snow blinds you. You navigate by memory and instinct, not sight.",                                            x: 76, y: 26 },
  { id: "3-6", region: 3, label: "The Summit",        story: "You stand above the clouds. The whole world is visible from here.",                                           x: 70, y: 20 },

  // ── Region 4 — Left Mainland & Old Road (descent and bridge) ─────────────
  { id: "4-1", region: 4, label: "The Descent",       story: "Coming down is its own discipline. You carry what you earned on the mountain.",                               x: 58, y: 28 },
  { id: "4-2", region: 4, label: "Shepherd's Cross",  story: "Four roads meet. For the first time, you choose direction rather than react to it.",                          x: 48, y: 35 },
  { id: "4-3", region: 4, label: "The Stone Bridge",  story: "An old crossing. It has held for centuries. So will the decisions you make here.",                            x: 35, y: 52 },
  { id: "4-4", region: 4, label: "Hearthside Cottage",story: "A lone dwelling on the sandy road. Rest. Recalibrate. Then move.",                                            x: 27, y: 48 },
  { id: "4-5", region: 4, label: "The Old Road",      story: "A long-forgotten path that still leads true. Discipline over time becomes legacy.",                           x: 32, y: 40 },
  { id: "4-6", region: 4, label: "Irongate Pass",     story: "The last open road before the kingdom walls. You are almost someone else entirely.",                          x: 38, y: 32 },
  { id: "4-7", region: 4, label: "The King's Road",   story: "Paved, wide, and certain. You walk it like you belong — because now you do.",                                 x: 44, y: 26 },

  // ── Region 5 — The Kingdom / Castle (top-center endgame) ─────────────────
  { id: "5-1", region: 5, label: "Outer Gates",       story: "The kingdom walls rise before you. Entry is earned, not given.",                                              x: 45, y: 34 },
  { id: "5-2", region: 5, label: "The Gatehouse",     story: "Guards who once turned others away step aside. Your record precedes you.",                                    x: 48, y: 28 },
  { id: "5-3", region: 5, label: "The Great Hall",    story: "Feasts, fire, fellowship. You sit at the table you once only dreamed of.",                                    x: 50, y: 23 },
  { id: "5-4", region: 5, label: "The Citadel Tower", story: "High above the hall, you see everything you've crossed to get here.",                                         x: 54, y: 18 },
  { id: "5-5", region: 5, label: "The Inner Keep",    story: "Only those who've mastered themselves reach this place. You are one of them.",                                x: 50, y: 14 },
  { id: "5-6", region: 5, label: "The Throne Room",   story: "You did not conquer this world. You earned the right to protect it. Rule wisely.",                           x: 46, y: 10 },
];

// ─── Status type ─────────────────────────────────────────────────────────────
// "SHIFTED"  = completed (backend: region_progress.status = 'completed')
// "CURRENT"  = active    (backend: region_progress.status = 'active')
// "LOCKED"   = not yet reached (default fallback)
// The `statuses` prop is the single source of truth — driven entirely by the
// backend via /me/bootstrap → active_region + region_progress rows.
// The component never mutates statuses itself.

// ─── Mock statuses (dev/preview only) ────────────────────────────────────────
export const MOCK_STATUSES = MAP_NODES.reduce((acc, node, i) => {
  if (i < 6)       acc[node.id] = "SHIFTED";
  else if (i === 6) acc[node.id] = "CURRENT";
  else              acc[node.id] = "LOCKED";
  return acc;
}, {});

// ─── Region accent colours ────────────────────────────────────────────────────
const REGION_META = {
  1: { color: "text-muted-emerald",  label: "The Island" },
  2: { color: "text-steel-violet",   label: "The Wilds" },
  3: { color: "text-pearl-text",     label: "The Mountain" },
  4: { color: "text-dawn-gold",      label: "The Old Road" },
  5: { color: "text-dawn-gold",      label: "The Kingdom" },
};

// ─── Node pin ─────────────────────────────────────────────────────────────────
function NodePin({ node, status, onClick, isActive }) {
  const isLocked  = status === "LOCKED";
  const isCurrent = status === "CURRENT";
  const isShifted = status === "SHIFTED";
  const isFinal   = node.id === "5-6";

  const sizeClass = isCurrent || isFinal ? "w-8 h-8" : "w-6 h-6";

  const colorClass = isShifted
    ? "bg-muted-emerald border-muted-emerald/50 text-abyssal-slate"
    : isCurrent
    ? "bg-dawn-gold border-dawn-gold/70 text-abyssal-slate"
    : "bg-slate-700 border-white/80 text-slate-300";

  const pulseClass = isCurrent
    ? "ring-2 ring-dawn-gold/40 ring-offset-1 ring-offset-transparent animate-pulse"
    : "";

  const interactClass = !isLocked
    ? "hover:scale-110 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dawn-gold"
    : "cursor-not-allowed opacity-60";

  const activeClass = isActive && !isLocked ? "scale-110" : "";

  return (
    <button
      onClick={() => !isLocked && onClick(node)}
      disabled={isLocked}
      aria-label={`${node.label} — ${status}`}
      className={[
        "absolute -translate-x-1/2 -translate-y-1/2 z-10",
        "flex items-center justify-center rounded-full border-2",
        "transition-all duration-200",
        sizeClass,
        colorClass,
        pulseClass,
        interactClass,
        activeClass,
      ].filter(Boolean).join(" ")}
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
    >
      {isFinal ? (
        <Crown strokeWidth={2} className="w-3.5 h-3.5" />
      ) : isShifted ? (
        <Star strokeWidth={2} className="w-2.5 h-2.5 fill-abyssal-slate" />
      ) : isLocked ? (
        <Lock strokeWidth={2} className="w-2.5 h-2.5" />
      ) : (
        <MapPin strokeWidth={2} className="w-3 h-3" />
      )}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
// Props:
//   statuses  — Record<nodeId, "SHIFTED" | "CURRENT" | "LOCKED">
//               Passed down from the page after /me/bootstrap resolves.
//               Defaults to MOCK_STATUSES for local dev.
//   onNodeClick — optional callback (node) => void for parent-level actions

export default function RegionMap({
  statuses = MOCK_STATUSES,
  onNodeClick,
}) {
  const [selected, setSelected] = useState(null);

  function handleNodeClick(node) {
    setSelected((prev) => (prev?.id === node.id ? null : node));
    onNodeClick?.(node);
  }

  // Path segments — sequential lines between nodes
  const pathSegments = MAP_NODES.slice(0, -1).map((node, i) => {
    const next      = MAP_NODES[i + 1];
    const fromSt    = statuses[node.id] ?? "LOCKED";
    const toSt      = statuses[next.id] ?? "LOCKED";
    const travelled = fromSt === "SHIFTED";
    const active    = fromSt === "SHIFTED" && toSt === "CURRENT";
    return { x1: node.x, y1: node.y, x2: next.x, y2: next.y, travelled, active };
  });

  const selectedStatus = selected ? (statuses[selected.id] ?? "LOCKED") : null;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="w-full space-y-3">

        {/* Legend */}
        <div className="flex items-center gap-6 px-1">
          {[
            { color: "bg-muted-emerald",                              label: "Completed" },
            { color: "bg-dawn-gold",                                  label: "Current"   },
            { color: "bg-slate-700 border border-white/40",           label: "Locked"    },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-muted-text">
              <span className={`w-3 h-3 rounded-full inline-block ${color}`} />
              {label}
            </span>
          ))}
        </div>

        {/* Map container */}
        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-tactical-border">

          {/* Base layer — map image */}
          <Image
            src="/map/map_image.png"
            alt="FinJourney region map"
            fill
            className="object-cover"
            priority
          />

          {/* Darkening overlay (as requested) */}
          <div
            className="absolute inset-0 pointer-events-none z-[1]"
            style={{ background: "rgba(15,23,42,0.35)" }}
          />

          {/* Vignette for depth */}
          <div
            className="absolute inset-0 pointer-events-none z-[1]"
            style={{
              background:
                "radial-gradient(ellipse at 50% 60%, transparent 45%, rgba(15,23,42,0.65) 100%)",
            }}
          />

          {/* Path layer — SVG dashed lines */}
          <svg
            className="absolute inset-0 w-full h-full z-[2] pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {pathSegments.map(({ x1, y1, x2, y2, travelled, active }, i) => (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={
                  travelled
                    ? "rgba(13,148,136,0.75)"
                    : "rgba(248,250,252,0.15)"
                }
                strokeWidth={travelled ? "0.6" : "0.4"}
                strokeDasharray={travelled ? "1.5 0.7" : "0.9 1.1"}
                strokeLinecap="round"
              />
            ))}
          </svg>

          {/* Node layer */}
          <div className="absolute inset-0 z-[3]">
            {MAP_NODES.map((node) => {
              const status = statuses[node.id] ?? "LOCKED";
              return (
                <Tooltip key={node.id}>
                  <TooltipTrigger asChild>
                    <span
                      className="absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    >
                      <NodePin
                        node={node}
                        status={status}
                        onClick={handleNodeClick}
                        isActive={selected?.id === node.id}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={6}
                    className="max-w-[220px] bg-canvas-surface border border-tactical-border text-pearl-text p-3 rounded-lg shadow-xl z-50"
                  >
                    <p className={`text-[10px] font-semibold tracking-widest uppercase mb-1 ${REGION_META[node.region]?.color}`}>
                      {REGION_META[node.region]?.label}
                    </p>
                    <p className="text-sm font-semibold leading-snug mb-1.5 text-pearl-text">
                      {node.label}
                    </p>
                    <p className="text-xs text-muted-text leading-relaxed">
                      {node.story}
                    </p>
                    <p className="text-[10px] mt-2 font-medium tracking-wide uppercase text-muted-text/50">
                      {status === "SHIFTED"
                        ? "✓ Completed"
                        : status === "CURRENT"
                        ? "▶ Active"
                        : "🔒 Locked"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Info panel — visible when a non-locked node is selected */}
        {selected && selectedStatus !== "LOCKED" && (
          <div className="animate-fade-in rounded-xl border border-tactical-border bg-canvas-surface p-4 flex items-start gap-4">
            <div
              className={`mt-0.5 w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                selectedStatus === "SHIFTED"
                  ? "bg-muted-emerald/15"
                  : "bg-dawn-gold/15"
              }`}
            >
              <MapPin
                strokeWidth={2}
                className={`w-4 h-4 ${
                  selectedStatus === "SHIFTED"
                    ? "text-muted-emerald"
                    : "text-dawn-gold"
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] font-semibold tracking-widest uppercase mb-0.5 ${REGION_META[selected.region]?.color}`}>
                {REGION_META[selected.region]?.label}
              </p>
              <p className="text-sm font-semibold text-pearl-text mb-1">
                {selected.label}
              </p>
              <p className="text-sm text-muted-text leading-relaxed">
                {selected.story}
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              aria-label="Dismiss"
              className="ml-auto shrink-0 text-muted-text hover:text-pearl-text transition-colors text-xs"
            >
              ✕
            </button>
          </div>
        )}

      </div>
    </TooltipProvider>
  );
}

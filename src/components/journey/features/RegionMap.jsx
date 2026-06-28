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
// 28 nodes across 5 regions, coordinates mapped to the actual map image.
// Journey order:
//   Island (5) → Swamp/Forest to Mountain Base (6) → Mountain (6)
//   → Left Road / Bridge / Back (5) → Kingdom (6)

export const MAP_NODES = [
  // ── Region 1 — The Island (bottom-left, 5 nodes) ─────────────────────────
  // Far-left island edge → left hut → main hut cluster → dock-left → sailboat crossing
  { id: "1-1", region: 1, label: "The Wreck", story: "You crawled ashore from the wreckage. Everything starts here, with nothing but will.", x: 8, y: 75 },
  { id: "1-2", region: 1, label: "Driftwood Camp", story: "A fire, a shelter, a plan. The first night alone teaches you what truly matters.", x: 15, y: 70 },
  { id: "1-3", region: 1, label: "Palm Cove", story: "You found fresh water and shade. Small wins compound into survival.", x: 20, y: 75 },
  { id: "1-4", region: 1, label: "The Old Dock", story: "Someone built this before you arrived. Their work carries you forward.", x: 24, y: 72 },
  { id: "1-5", region: 1, label: "The Crossing", story: "A vessel waits in the shallows. You leave the island behind. No return.", x: 31, y: 74 },

  // ── Region 2 — Swamp & Forest to Mountain Base (bottom-right, 6 nodes) ───
  // After water crossing → far-right forest bottom → sweep left along bottom
  // (3 swamp nodes) → beach/bay → mountain base
  { id: "2-1", region: 2, label: "Bogwater Landing", story: "The mainland smells of rot and rain. Every step forward costs something.", x: 78, y: 80 },
  { id: "2-2", region: 2, label: "The Sunken Road", story: "The path is swallowed by murk. You must feel your way through.", x: 90, y: 78 },
  { id: "2-3", region: 2, label: "Thornwall", story: "Dense and unforgiving. The forest tests your patience before your strength.", x: 87, y: 67 },
  { id: "2-4", region: 2, label: "The Rotwood", story: "Trees that look solid crumble at the touch. Trust nothing that hasn't been tested.", x: 75, y: 67 },
  { id: "2-5", region: 2, label: "The Bay Shore", story: "The bog gives way to open sand. You breathe again. The mountain looms ahead.", x: 67, y: 62 },
  { id: "2-6", region: 2, label: "Stonefoot", story: "The trees thin. Rock replaces mud. The mountain is no longer a rumor.", x: 58, y: 56 },

  // ── Region 3 — The Mountain (right side, 6 nodes) ────────────────────────
  // Middle between caves (below) → left cave → right cave
  // → middle between caves (upper) → right snow peak → peak of mountain
  { id: "3-1", region: 3, label: "The Threshold", story: "You stand between two dark openings. Either way leads through. You must choose.", x: 59, y: 45 },
  { id: "3-2", region: 3, label: "Cave of Echoes", story: "The left tunnel. Voices of doubt bounce off every wall. You pass through anyway.", x: 63, y: 37 },
  { id: "3-3", region: 3, label: "The Deep Vein", story: "The right tunnel. Something valuable runs through this rock. You learn to mine it.", x: 80, y: 44 },
  { id: "3-4", region: 3, label: "Greyspine Ridge", story: "Back above ground. The two paths reunite here. What you found below, you carry up.", x: 70, y: 39 },
  { id: "3-5", region: 3, label: "The Whiteout", story: "Snow blinds you at the right peak. You navigate by memory and instinct, not sight.", x: 84, y: 30 },
  { id: "3-6", region: 3, label: "The Summit", story: "You stand above the clouds. The whole world is visible from here. You've earned this view.", x: 72, y: 22 },

  // ── Region 4 — Left Road / Bridge / Back to Right Hut (5 nodes) ──────────
  // Center path junction → stone bridge → cottage → back across → near right-bottom mainland hut
  { id: "4-1", region: 4, label: "The Descent", story: "Coming down is its own discipline. You carry what you earned on the mountain.", x: 56, y: 35 },
  { id: "4-2", region: 4, label: "The Stone Bridge", story: "An old crossing over still water. It has held for centuries. So will you.", x: 30, y: 50 },
  { id: "4-3", region: 4, label: "Hearthside Cottage", story: "A lone dwelling on the sandy road. Rest. Recalibrate. Then move.", x: 27, y: 41 },
  { id: "4-4", region: 4, label: "The Old Road", story: "A long-forgotten path that still leads true. Discipline over time becomes legacy.", x: 16, y: 40 },
  { id: "4-5", region: 4, label: "Irongate Pass", story: "The last crossroads before the kingdom walls. You are almost someone else entirely.", x: 45, y: 55 },

  // ── Region 5 — The Kingdom / Castle (top-center, 6 nodes) ────────────────
  // Castle gate base → left castle wall → right castle wall
  // → upper-left tower → upper-right tower → throne (top-center)
  { id: "5-1", region: 5, label: "Outer Gates", story: "The kingdom walls rise before you. Entry is earned, not given.", x: 44, y: 36 },
  { id: "5-2", region: 5, label: "The Left Rampart", story: "You walk the western wall. Below you, the road you traveled stretches to the horizon.", x: 38, y: 28 },
  { id: "5-3", region: 5, label: "The Right Rampart", story: "The eastern wall faces the mountain. You remember every step of that climb.", x: 54, y: 26 },
  { id: "5-4", region: 5, label: "The West Tower", story: "High above the hall. You see everything you've crossed to get here.", x: 40, y: 18 },
  { id: "5-5", region: 5, label: "The East Tower", story: "The final watch post. Only those who've mastered themselves stand here.", x: 52, y: 16 },
  { id: "5-6", region: 5, label: "The Throne Room", story: "You did not conquer this world. You earned the right to protect it. Rule wisely.", x: 46, y: 10 },
];

// ─── Status types ─────────────────────────────────────────────────────────────
// SHIFTED  = completed  — backend: region_progress.status = 'completed'
// CURRENT  = active now — backend: region_progress.status = 'active'
// LOCKED   = not reached yet (default)
// The `statuses` prop is the single source of truth, driven by /me/bootstrap.
// This component never mutates statuses itself.

// ─── Mock statuses (dev/preview only — replace with backend data in prod) ────
export const MOCK_STATUSES = MAP_NODES.reduce((acc, node, i) => {
  if (i < 5) acc[node.id] = "SHIFTED";
  else if (i === 5) acc[node.id] = "CURRENT";
  else acc[node.id] = "LOCKED";
  return acc;
}, {});

// ─── Region metadata ──────────────────────────────────────────────────────────
const REGION_META = {
  1: { color: "text-muted-emerald", label: "The Island" },
  2: { color: "text-steel-violet", label: "The Wilds" },
  3: { color: "text-pearl-text", label: "The Mountain" },
  4: { color: "text-dawn-gold", label: "The Old Road" },
  5: { color: "text-dawn-gold", label: "The Kingdom" },
};

// ─── Node pin ─────────────────────────────────────────────────────────────────
function NodePin({ node, status, onClick, isActive }) {
  const isLocked = status === "LOCKED";
  const isCurrent = status === "CURRENT";
  const isShifted = status === "SHIFTED";
  const isFinal = node.id === "5-6";

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

  return (
    <button
      onClick={() => !isLocked && onClick(node)}
      disabled={isLocked}
      aria-label={`${node.label} — ${status}`}
      className={[
        "absolute -translate-x-1/2 -translate-y-1/2 z-10",
        "flex items-center justify-center rounded-full border-2",
        "transition-all duration-200",
        sizeClass, colorClass, pulseClass, interactClass,
        isActive && !isLocked ? "scale-110" : "",
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
//   statuses    — Record<nodeId, "SHIFTED"|"CURRENT"|"LOCKED">
//                 From /me/bootstrap → region_progress, passed by parent page.
//                 Falls back to MOCK_STATUSES in dev.
//   onNodeClick — optional (node) => void callback for parent navigation

export default function RegionMap({ statuses = MOCK_STATUSES, onNodeClick }) {
  const [selected, setSelected] = useState(null);

  function handleNodeClick(node) {
    setSelected((prev) => (prev?.id === node.id ? null : node));
    onNodeClick?.(node);
  }

  const pathSegments = MAP_NODES.slice(0, -1).map((node, i) => {
    const next = MAP_NODES[i + 1];
    const fromSt = statuses[node.id] ?? "LOCKED";
    const toSt = statuses[next.id] ?? "LOCKED";
    const travelled = fromSt === "SHIFTED";
    return { x1: node.x, y1: node.y, x2: next.x, y2: next.y, travelled };
  });

  const selectedStatus = selected ? (statuses[selected.id] ?? "LOCKED") : null;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="w-full space-y-3">

        {/* Legend */}
        <div className="flex items-center gap-6 px-1">
          {[
            { color: "bg-muted-emerald", label: "Completed" },
            { color: "bg-dawn-gold", label: "Current" },
            { color: "bg-slate-700 border border-white/40", label: "Locked" },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-muted-text">
              <span className={`w-3 h-3 rounded-full inline-block ${color}`} />
              {label}
            </span>
          ))}
        </div>

        {/* Map container */}
        <div className="relative w-full aspect-[3/2] rounded-xl overflow-hidden border border-tactical-border">

          {/* Base layer */}
          <Image
            src="/map/map_image.png"
            alt="FinJourney region map"
            fill
            className="object-cover"
            priority
          />

          {/* Darkening overlay */}
          <div
            className="absolute inset-0 pointer-events-none z-[1]"
            style={{ background: "rgba(15,23,42,0.32)" }}
          />

          {/* Vignette */}
          <div
            className="absolute inset-0 pointer-events-none z-[1]"
            style={{
              background:
                "radial-gradient(ellipse at 50% 60%, transparent 40%, rgba(15,23,42,0.60) 100%)",
            }}
          />

          {/* Path layer */}
          <svg
            className="absolute inset-0 w-full h-full z-[2] pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {pathSegments.map(({ x1, y1, x2, y2, travelled }, i) => (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={travelled ? "rgba(13,148,136,0.80)" : "rgba(248,250,252,0.18)"}
                strokeWidth={travelled ? "0.65" : "0.4"}
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
                      {status === "SHIFTED" ? "✓ Completed"
                        : status === "CURRENT" ? "▶ Active"
                          : "🔒 Locked"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Info panel */}
        {selected && selectedStatus !== "LOCKED" && (
          <div className="animate-fade-in rounded-xl border border-tactical-border bg-canvas-surface p-4 flex items-start gap-4">
            <div
              className={`mt-0.5 w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${selectedStatus === "SHIFTED" ? "bg-muted-emerald/15" : "bg-dawn-gold/15"
                }`}
            >
              <MapPin
                strokeWidth={2}
                className={`w-4 h-4 ${selectedStatus === "SHIFTED" ? "text-muted-emerald" : "text-dawn-gold"
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

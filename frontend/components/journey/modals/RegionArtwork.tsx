// =============================================================================
// features/journey/artwork/RegionArtwork.tsx
//
// Renderer-driven region artwork registry (assets.md architecture).
//
// The backend sends region_id: "quiet_valley".
// The frontend maps it to the local SVG component via REGION_ARTWORK_REGISTRY.
//
// Adding a new region:
//   1. Create a new SVG component below (e.g. IronPlainsArtwork)
//   2. Add the entry to REGION_ARTWORK_REGISTRY
//   No API contract changes required.
//
// Rules:
//   - Inline SVG only — no external image URLs in the registry
//   - All artwork is aria-hidden (decorative)
//   - viewBox="0 0 640 200", height={200} — consistent aspect ratio
//   - Dark palette only — these render on canvas-surface cards
//   - No gradients, no glow, no text inside SVGs
// =============================================================================

import type { ComponentType } from "react";
import { Globe } from "lucide-react";

// ─── Artworks ─────────────────────────────────────────────────────────────────

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
      {/* Night sky */}
      <rect width="640" height="200" fill="#090e1b" />

      {/* Stars — three depth layers via opacity */}
      {(
        [
          // Near stars (brightest)
          [42, 20, 0.6],  [162, 13, 0.65], [298, 16, 0.55],
          [436, 19, 0.6], [572, 14, 0.55],
          // Mid stars
          [98, 36, 0.4],  [230, 28, 0.45], [368, 33, 0.42],
          [510, 38, 0.45],[600, 48, 0.38],
          // Distant stars (dimmest)
          [70, 56, 0.28], [200, 46, 0.32], [338, 52, 0.28],
          [476, 60, 0.32],[24, 44, 0.22],  [148, 64, 0.25],
          [412, 66, 0.22],[540, 72, 0.2],
        ] as [number, number, number][]
      ).map(([cx, cy, opacity], i) => (
        <circle key={i} cx={cx} cy={cy} r={1} fill="#f8fafc" opacity={opacity} />
      ))}

      {/* Crescent moon — top-right quarter */}
      <circle cx="564" cy="38" r="18" fill="#0d1829" />
      <circle cx="556" cy="33" r="14" fill="#090e1b" />

      {/* Distant mountain ridge — lightest layer */}
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

      {/* Winding path — muted-emerald dashed */}
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
      <circle cx="314" cy="160" r="5"  fill="#0d9488" />
      <circle cx="314" cy="160" r="11" fill="#0d9488" opacity={0.18} />
    </svg>
  );
}

// Add future region artworks here:
// function IronPlainsArtwork() { … }
// function SilentCoastArtwork() { … }

// ─── Registry ─────────────────────────────────────────────────────────────────

const REGION_ARTWORK_REGISTRY: Record<string, ComponentType> = {
  quiet_valley: QuietValleyArtwork,
  // iron_plains:  IronPlainsArtwork,
  // silent_coast: SilentCoastArtwork,
};

// ─── Fallback ─────────────────────────────────────────────────────────────────

function FallbackArtwork() {
  return (
    <div
      className="w-full bg-abyssal-slate flex items-center justify-center"
      style={{ height: 200 }}
      aria-hidden="true"
    >
      <Globe size={40} strokeWidth={2} className="text-tactical-border" />
    </div>
  );
}

// ─── RegionArtwork (exported) ─────────────────────────────────────────────────

export interface RegionArtworkProps {
  /** Stable backend identifier, e.g., "quiet_valley" */
  regionId: string;
  /** Extra classes applied to a wrapper div (only rendered for fallback) */
  className?: string;
}

export function RegionArtwork({ regionId }: RegionArtworkProps) {
  const Artwork = REGION_ARTWORK_REGISTRY[regionId];
  return Artwork ? <Artwork /> : <FallbackArtwork />;
}

/**
 * features/journey/artwork/RegionArtwork.tsx
 *
 * Stub for the region artwork registry.
 *
 * This component renders a placeholder image/gradient for each region.
 * The real artwork assets will be swapped in during the design asset phase.
 * Until then, this stub renders a visually polished gradient fallback using
 * the region ID to derive a deterministic colour, so the modal layout is
 * accurate and testable.
 *
 * Canonical path: components/journey/artwork/RegionArtwork.tsx
 * (Imported as @/features/journey/artwork/RegionArtwork — path alias maps
 *  @/features/** to components/**)
 */

'use client';

// Deterministic colour from regionId — maps the ID string to one of the
// design-system accent colours so each region feels distinct.
function regionGradient(regionId: string): string {
  const gradients = [
    'from-muted-emerald/20 to-abyssal-slate',
    'from-steel-violet/20 to-abyssal-slate',
    'from-dawn-gold/20 to-abyssal-slate',
    'from-terracotta/20 to-abyssal-slate',
  ];
  let hash = 0;
  for (let i = 0; i < regionId.length; i++) {
    hash = (hash * 31 + regionId.charCodeAt(i)) >>> 0;
  }
  return gradients[hash % gradients.length];
}

interface RegionArtworkProps {
  regionId: string;
  /** Override height class — defaults to h-40 */
  heightClass?: string;
}

export function RegionArtwork({
  regionId,
  heightClass = 'h-40',
}: RegionArtworkProps) {
  const gradient = regionGradient(regionId);

  return (
    <div
      className={`w-full ${heightClass} bg-gradient-to-b ${gradient} flex items-center justify-center`}
      aria-hidden="true"
      data-region-id={regionId}
    >
      {/* Placeholder visual — replaced by real artwork in design asset phase */}
      <div className="h-12 w-12 rounded-full border border-tactical-border/30 bg-canvas-surface/20" />
    </div>
  );
}

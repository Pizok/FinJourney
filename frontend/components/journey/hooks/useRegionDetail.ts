/**
 * features/journey/hooks/useRegionDetail.ts
 *
 * TanStack Query hook for fetching extra region detail data.
 *
 * Why this exists:
 *   The Journey overview payload provides a compact CurrentRegion summary.
 *   The RegionDetailModal needs additional fields (entered_at,
 *   milestones_earned, narrative description) that are too heavy for the
 *   overview. This hook fetches them on demand, using the overview summary
 *   as placeholderData so the modal never renders blank.
 *
 * Canonical path: components/journey/hooks/useRegionDetail.ts
 * (Imported as @/features/journey/hooks/useRegionDetail — path alias maps
 *  @/features/** to components/**)
 */

import { useQuery } from '@tanstack/react-query';
import type { CurrentRegion } from '@/components/journey/types/journey.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegionDetailData extends CurrentRegion {
  /** Full narrative description of the region — not included in overview. */
  description?: string;
  /** ISO date when the user entered this region. */
  entered_at?: string;
  /** Number of milestones earned in this region so far. */
  milestones_earned?: number;
}

// ─── API fetcher ──────────────────────────────────────────────────────────────

async function fetchRegionDetail(regionId: string): Promise<RegionDetailData> {
  const res = await fetch(`/api/v1/journey/regions/${regionId}`, {
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error(`Region detail request failed: ${res.status}`);
  }

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.error?.message ?? 'Unknown error');
  }

  return json.data as RegionDetailData;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseRegionDetailOptions {
  regionId: string;
  /** Overview summary — used as placeholder data while the detail fetches. */
  summary: CurrentRegion;
}

export function useRegionDetail({ regionId, summary }: UseRegionDetailOptions) {
  return useQuery<RegionDetailData>({
    queryKey: ['journey', 'region', regionId],
    queryFn: () => fetchRegionDetail(regionId),
    // Use the overview summary as placeholder so the modal renders immediately.
    // placeholderData keeps isPlaceholderData === true until the real fetch resolves.
    placeholderData: summary as RegionDetailData,
    staleTime: 5 * 60_000,   // 5 min — region data rarely changes mid-session
    enabled: !!regionId,
  });
}

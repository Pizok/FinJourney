/**
 * features/journey/hooks/useReviewDetail.ts
 *
 * TanStack Query hook for fetching extra quarterly review detail data.
 *
 * Why this exists:
 *   The Journey overview payload includes a compact QuarterlyReview summary
 *   with win_conditions. The ReviewDetailModal may need additional detail
 *   (reward/penalty breakdowns, full score) when available. This hook fetches
 *   them on demand using the summary as placeholderData.
 *
 * Canonical path: components/journey/hooks/useReviewDetail.ts
 * (Imported as @/features/journey/hooks/useReviewDetail — path alias maps
 *  @/features/** to components/**)
 */

import { useQuery } from '@tanstack/react-query';
import type { QuarterlyReview } from '@/components/journey/types/journey.types';
import { apiFetchClient } from '@/lib/apiClient.client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReviewDetailData extends QuarterlyReview {
  /** Final performance percentage (completed reviews). */
  score?: number;
  /** XP reward for passing this review. */
  reward_xp?: number;
  /** Gold reward for passing this review. */
  reward_gold?: number;
  /** HP penalty for failing this review. */
  penalty_hp?: number;
  /** Text descriptors of penalty effects (e.g. \"Shield destroyed\"). */
  penalty_effects?: string[];
  /** Number of days remaining before this review closes (active reviews). */
  days_remaining?: number;
  /** Overall completion percentage (active reviews). */
  completion_percentage?: number;
  /** Whether the rewards for this review have been claimed. */
  rewards_claimed?: boolean;
}

// ─── API fetcher ──────────────────────────────────────────────────────────────

async function fetchReviewDetail(reviewId: string): Promise<ReviewDetailData> {
  const data = await apiFetchClient<ReviewDetailData>(`journey/reviews/${reviewId}`);
  return data;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseReviewDetailOptions {
  reviewId: string;
  /** Overview summary — used as placeholder data while the detail fetches. */
  summary: QuarterlyReview;
}

export function useReviewDetail({ reviewId, summary }: UseReviewDetailOptions) {
  return useQuery<ReviewDetailData>({
    queryKey: ['journey', 'review', reviewId],
    queryFn: () => fetchReviewDetail(reviewId),
    placeholderData: summary as ReviewDetailData,
    staleTime: 5 * 60_000,
    enabled: !!reviewId,
  });
}

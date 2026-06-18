"use client";

// =============================================================================
// features/journey/components/QuarterlyReviewSection.tsx
//
// Quarterly reviews section of the Journey page.
//
// Content (Journey Page Specification §5 — QuarterlyReviewSection):
//   - Active review card (if exists) — shown first, full opacity
//   - Past review cards (completed / failed) — shown below, dimmed
//   - Empty state when no reviews exist: "Your first review is being prepared."
//
// States:
//   loading  → renders 2 skeleton review card placeholders
//   empty    → EmptyState with Trophy icon
//   data     → active review (if any) + past reviews list
//
// Interaction:
//   Each ReviewCard calls openReviewModal(id, summary) on click.
//   The ReviewDetailModal (Part 4) reads from the store and fetches the
//   full review via GET /api/v1/journey/reviews/{review_id}.
//
// Data:
//   Reads from useOverviewData() — overview.active_review and
//   overview.past_reviews. No secondary fetch needed for the list view.
// =============================================================================

import { useCallback } from "react";
import { Trophy } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { ReviewCard } from "./ReviewCard";
import { useOverviewData, useModalActions } from "@/components/journey/stores/journeyStore";
import type { QuarterlyReview } from "@/components/journey/types/journey.types";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ReviewCardSkeleton() {
  return (
    <Card padding="none" aria-hidden="true">
      <div className="p-5">
        <div className="flex items-start gap-3">
          {/* Icon placeholder */}
          <div className="w-9 h-9 rounded-lg bg-abyssal-slate animate-pulse shrink-0" />
          {/* Content placeholder */}
          <div className="flex-1 flex flex-col gap-2 pt-1">
            <div className="h-[15px] w-48 rounded bg-abyssal-slate animate-pulse" />
            <div className="flex gap-2">
              <div className="h-[18px] w-16 rounded-full bg-abyssal-slate animate-pulse" />
              <div className="h-[18px] w-24 rounded-full bg-abyssal-slate animate-pulse" />
            </div>
          </div>
          {/* Chevron placeholder */}
          <div className="w-4 h-4 rounded bg-abyssal-slate animate-pulse shrink-0 mt-1" />
        </div>
      </div>
    </Card>
  );
}

function QuarterlyReviewSkeleton() {
  return (
    <section
      aria-label="Quarterly reviews loading"
      aria-busy="true"
      data-testid="quarterly-review-skeleton"
    >
      {/* Section label skeleton */}
      <div className="h-3 w-40 rounded bg-canvas-surface animate-pulse mb-4" />
      <div className="flex flex-col gap-3">
        <ReviewCardSkeleton />
        <ReviewCardSkeleton />
      </div>
    </section>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel() {
  return (
    <p
      className={[
        "font-sans text-[11px] font-semibold uppercase",
        "tracking-[0.1em] text-muted-text mb-4",
      ].join(" ")}
    >
      Quarterly Reviews
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface QuarterlyReviewSectionProps {
  isLoading?: boolean;
}

export function QuarterlyReviewSection({
  isLoading = false,
}: QuarterlyReviewSectionProps) {
  const overview = useOverviewData();
  const { openReviewModal } = useModalActions();

  const handleReviewClick = useCallback(
    (review: QuarterlyReview) => {
      openReviewModal(review.id, review);
    },
    [openReviewModal]
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) return <QuarterlyReviewSkeleton />;

  const activeReview = overview.active_review;
  const pastReviews = overview.past_reviews ?? [];
  const hasAny = activeReview != null || pastReviews.length > 0;

  // ── Empty ────────────────────────────────────────────────────────────────
  if (!hasAny) {
    return (
      <section
        aria-label="Quarterly reviews"
        data-testid="quarterly-review-section"
        className="animate-fade-in"
      >
        <SectionLabel />
        <EmptyState
          icon={Trophy}
          message="Your first review is being prepared."
          description="Quarterly reviews appear every 90 account days. Check back as you progress."
        />
      </section>
    );
  }

  // ── Data ─────────────────────────────────────────────────────────────────
  return (
    <section
      aria-label="Quarterly reviews"
      data-testid="quarterly-review-section"
      className="animate-fade-in"
    >
      <SectionLabel />

      <div className="flex flex-col gap-3">
        {/*
         * Active review is rendered first — it demands immediate attention.
         * Past reviews follow in reverse-chronological display order
         * (they arrive from the API newest-first).
         */}
        {activeReview && (
          <ReviewCard
            review={activeReview}
            onReviewClick={handleReviewClick}
          />
        )}

        {pastReviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            onReviewClick={handleReviewClick}
          />
        ))}
      </div>
    </section>
  );
}

"use client";

// =============================================================================
// features/journey/components/ReviewCard.tsx
//
// Single quarterly review card. Used inside QuarterlyReviewSection.
//
// Content:
//   - Type icon in a coloured container (maps ChallengeType → icon)
//   - Review title + optional quarter badge (Q1, Q2, Q3)
//   - Status badge + supporting detail (days remaining OR final score)
//   - Overall progress bar — active reviews only
//   - ChevronRight tap/click indicator → calls onReviewClick from the parent
//
// Visual states:
//   active     → full opacity, muted-emerald accent, progress bar visible
//   completed  → reduced opacity (72%), muted accent, score displayed
//   failed     → reduced opacity, terracotta accent, no progress bar
//   upcoming   → full opacity, steel-violet accent, no progress bar
//
// Interaction:
//   - Interactive Card (hover:border-muted-emerald)
//   - onClick → opens ReviewDetailModal via onReviewClick prop
//   - focus-visible ring for keyboard accessibility (WCAG 2.4.7)
//
// Design rules:
//   - No hardcoded hex values — all colours via Tailwind theme classes
//   - No glow effects on card or icon container
//   - Type icon container uses 12% alpha background (same as Badge pattern)
//   - Progress bar uses --color-muted-emerald (active) or --color-steel-violet
// =============================================================================

import { type ReactNode } from "react";
import {
  Zap,
  Shield,
  Compass,
  Flame,
  Target,
  TrendingUp,
  Star,
  ChevronRight,
  Timer,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { QuarterlyReview, ReviewType, ReviewStatus } from "@/components/journey/types/journey.types";

// ─── Type icon registry ───────────────────────────────────────────────────────

const REVIEW_TYPE_ICONS: Record<ReviewType, ReactNode> = {
  boss_fight: <Zap size={14} strokeWidth={2} aria-hidden="true" />,
  savings_fortress: <Shield size={14} strokeWidth={2} aria-hidden="true" />,
  expedition: <Compass size={14} strokeWidth={2} aria-hidden="true" />,
  survival_challenge: <Flame size={14} strokeWidth={2} aria-hidden="true" />,
  debt_raid: <Target size={14} strokeWidth={2} aria-hidden="true" />,
  income_trial: <TrendingUp size={14} strokeWidth={2} aria-hidden="true" />,
};

const FALLBACK_ICON = <Star size={14} strokeWidth={2} aria-hidden="true" />;

// ─── Status → visual config ────────────────────────────────────────────────────

interface StatusConfig {
  /** Tailwind text colour for the icon container */
  iconColor: string;
  /** Tailwind bg colour at ~12% alpha for the icon container */
  iconBg: string;
  /** Tailwind border colour at ~28% alpha for the icon container */
  iconBorder: string;
  /** Whether the card renders at reduced opacity (past/failed events) */
  dimmed: boolean;
  /** Progress bar CSS variable — only used when status === "active" */
  progressVar: string;
}

const STATUS_CONFIG: Record<ReviewStatus, StatusConfig> = {
  active: {
    iconColor: "text-muted-emerald",
    iconBg: "bg-muted-emerald/10",
    iconBorder: "border-muted-emerald/25",
    dimmed: false,
    progressVar: "--color-muted-emerald",
  },
  completed: {
    iconColor: "text-muted-text",
    iconBg: "bg-tactical-border/20",
    iconBorder: "border-tactical-border/40",
    dimmed: true,
    progressVar: "--color-steel-violet",
  },
  failed: {
    iconColor: "text-terracotta",
    iconBg: "bg-terracotta/10",
    iconBorder: "border-terracotta/25",
    dimmed: true,
    progressVar: "--color-terracotta",
  },
  upcoming: {
    iconColor: "text-steel-violet",
    iconBg: "bg-steel-violet/10",
    iconBorder: "border-steel-violet/25",
    dimmed: false,
    progressVar: "--color-steel-violet",
  },
};

// ─── Supporting detail line ────────────────────────────────────────────────────
// Renders contextual info below the badge row:
//   active    → "12 days remaining" in terracotta (creates urgency)
//   completed → "91% score" in dawn-gold
//   failed    → nothing (status badge is sufficient)
//   upcoming  → nothing

function ReviewDetail({ review }: { review: QuarterlyReview }) {
  if (review.status === "active" && review.days_remaining != null) {
    const urgent = review.days_remaining <= 7;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-[3px]",
          "font-sans text-[12px]",
          urgent ? "text-terracotta" : "text-muted-text"
        )}
      >
        <Timer size={11} strokeWidth={2} aria-hidden="true" />
        {review.days_remaining}{" "}
        {review.days_remaining === 1 ? "day" : "days"} remaining
      </span>
    );
  }

  if (review.status === "completed" && review.score != null) {
    return (
      <span className="font-sans text-[12px] text-dawn-gold font-medium tabular-nums">
        {review.score}% score
      </span>
    );
  }

  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReviewCardProps {
  review: QuarterlyReview;
  /** Called when the card is tapped/clicked. Parent opens the detail modal. */
  onReviewClick: (review: QuarterlyReview) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReviewCard({ review, onReviewClick }: ReviewCardProps) {
  const config = STATUS_CONFIG[review.status];
  const icon = REVIEW_TYPE_ICONS[review.type] ?? FALLBACK_ICON;

  const showProgressBar =
    review.status === "active" && review.completion_percentage != null;

  return (
    <Card
      interactive
      padding="none"
      className={cn(
        "transition-opacity duration-200",
        config.dimmed && "opacity-[0.72]"
      )}
      onClick={() => onReviewClick(review)}
      role="button"
      tabIndex={0}
      aria-label={`${review.title} — ${review.status}${
        review.status === "active" && review.days_remaining != null
          ? `, ${review.days_remaining} days remaining`
          : ""
      }${
        review.status === "completed" && review.score != null
          ? `, ${review.score}% score`
          : ""
      }`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onReviewClick(review);
        }
      }}
      data-testid={`review-card-${review.id}`}
    >
      <div className="p-5">
        {/* ── Main row: icon + content + chevron ───────────────────── */}
        <div className="flex items-start gap-3">

          {/* Type icon container */}
          <div
            className={cn(
              "flex items-center justify-center shrink-0",
              "w-9 h-9 rounded-lg border",
              config.iconColor,
              config.iconBg,
              config.iconBorder
            )}
            aria-hidden="true"
          >
            {icon}
          </div>

          {/* Title + badge row */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-[5px]">
              <span
                className={cn(
                  "font-display text-[15px] font-semibold text-pearl-text",
                  "leading-tight truncate"
                )}
              >
                {review.title}
              </span>
              {review.quarter && (
                <Badge variant="muted">{review.quarter}</Badge>
              )}
            </div>

            {/* Status badge + supporting detail */}
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={review.status} />
              <ReviewDetail review={review} />
            </div>
          </div>

          {/* Drill-down indicator */}
          <ChevronRight
            size={15}
            strokeWidth={2}
            className="text-muted-text shrink-0 mt-[2px]"
            aria-hidden="true"
          />
        </div>

        {/* ── Active progress bar ───────────────────────────────────── */}
        {showProgressBar && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-sans text-[12px] text-muted-text">
                Overall progress
              </span>
              <span className="font-sans text-[12px] font-medium text-pearl-text tabular-nums">
                {review.completion_percentage}%
              </span>
            </div>
            <Progress
              value={review.completion_percentage!}
              max={100}
              colorVar={config.progressVar}
              height="sm"
              aria-label={`${review.title} progress: ${review.completion_percentage}%`}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

"use client";

// =============================================================================
// features/journey/modals/ReviewDetailModal.tsx
//
// Drill-down modal for a quarterly review — opened by tapping a ReviewCard.
//
// Content (journey_prd.md §5 "Quarterly Review Drill-Down"):
//   - Review title (h2) + status badge
//   - Urgency countdown (active reviews — days remaining in Terracotta)
//   - Objectives list: each win condition with a labelled progress bar
//   - Final performance score (completed reviews — Steel Violet)
//   - Reward showcase / Failure consequences side-by-side grid
//
// Data:
//   useReviewDetail({ reviewId, summary }) — placeholder from the review card
//   means objectives are visible immediately for active reviews (win_conditions
//   is included in the overview payload). The detail fetch may add reward/
//   penalty breakdowns if the API provides them.
//
// Accessibility:
//   Modal.tsx handles the focus trap, Escape, aria-modal, and aria-labelledby.
//   The objectives list uses role="list" and each row is role="listitem".
//   Progress bars carry aria-label with the objective text + percentage.
//
// Design rules:
//   - Objectives section label: uppercase 11px font-sans muted-text
//   - Win condition completed (100%): muted-emerald fill
//   - Win condition in-progress (<100%): steel-violet fill
//   - Reward tile: muted-emerald accent (8% bg, 22% border)
//   - Penalty tile: terracotta accent (8% bg, 22% border)
//   - Score banner: steel-violet accent
//   - No hardcoded hex values
// =============================================================================

import { Timer } from "lucide-react";
import { Modal, ModalLoadingBody, ModalErrorBody } from "@/components/ui/Modal";
import { Progress } from "@/components/ui/Progress";
import { StatusBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  useReviewDetail,
  type ReviewDetailData,
} from "@/features/journey/hooks/useReviewDetail";
import type {
  QuarterlyReview,
  WinCondition,
} from "@/components/journey/types/journey.types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetchClient } from "@/lib/apiClient.client";

// ─── Urgency countdown ────────────────────────────────────────────────────────

function UrgencyBar({ daysRemaining }: { daysRemaining: number }) {
  const critical = daysRemaining <= 3;
  const urgent = daysRemaining <= 7;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border",
        critical
          ? "bg-terracotta/10 border-terracotta/25 text-terracotta"
          : urgent
          ? "bg-terracotta/6 border-terracotta/18 text-terracotta"
          : "bg-abyssal-slate border-tactical-border text-muted-text"
      )}
      aria-label={`${daysRemaining} days remaining`}
    >
      <Timer size={12} strokeWidth={2} aria-hidden="true" className="shrink-0" />
      <span className="font-sans text-[12px] font-medium">
        {daysRemaining} {daysRemaining === 1 ? "day" : "days"} remaining
      </span>
    </div>
  );
}

// ─── Single win condition row ─────────────────────────────────────────────────

function WinConditionRow({ condition }: { condition: WinCondition }) {
  const { label, current, target } = condition;
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const done = pct >= 100;

  // Format monetary values (> 1000) with K abbreviation
  const formatValue = (v: number) =>
    v > 999 ? `Rp${Math.round(v / 1_000)}K` : String(v);

  const valueLabel =
    current > 1_000 || target > 1_000
      ? `${formatValue(current)} / ${formatValue(target)}`
      : `${current} / ${target}`;

  return (
    <li role="listitem" className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-sans text-[13px] text-pearl-text">{label}</span>
        <span className="font-sans text-[12px] text-muted-text tabular-nums shrink-0">
          {valueLabel}
        </span>
      </div>
      <Progress
        value={current}
        max={target}
        colorVar={done ? "--color-muted-emerald" : "--color-steel-violet"}
        height="sm"
        aria-label={`${label}: ${pct}% complete`}
      />
    </li>
  );
}

// ─── Objectives section ───────────────────────────────────────────────────────

function ObjectivesSection({ conditions }: { conditions: WinCondition[] }) {
  if (conditions.length === 0) return null;

  return (
    <div className="mb-6">
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-text mb-3">
        Objectives
      </p>
      <ul role="list" className="flex flex-col gap-4" aria-label="Review objectives">
        {conditions.map((c, i) => (
          <WinConditionRow key={i} condition={c} />
        ))}
      </ul>
    </div>
  );
}

// ─── Score banner (completed reviews) ────────────────────────────────────────

function ScoreBanner({ score }: { score: number }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg mb-5
                 bg-steel-violet/8 border border-steel-violet/22"
      role="note"
      aria-label={`Final score: ${score}%`}
    >
      <span className="font-sans text-[12px] text-steel-violet font-medium">
        Final score: {score}%
      </span>
      <span className="font-sans text-[12px] text-muted-text">
        — Performance logged to your progression record.
      </span>
    </div>
  );
}

// ─── Reward / consequence grid ────────────────────────────────────────────────

interface OutcomeTileProps {
  kind: "reward" | "penalty";
  xpOrHp: string;
  extras?: string[];
}

function OutcomeTile({ kind, xpOrHp, extras = [] }: OutcomeTileProps) {
  const isReward = kind === "reward";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-4 rounded-lg border",
        isReward
          ? "bg-muted-emerald/8 border-muted-emerald/22"
          : "bg-terracotta/8 border-terracotta/22"
      )}
    >
      <p className="font-sans text-[11px] text-muted-text uppercase tracking-[0.08em] font-semibold">
        {isReward ? "Passing reward" : "Failure penalty"}
      </p>
      <p
        className={cn(
          "font-sans text-[13px] font-semibold",
          isReward ? "text-muted-emerald" : "text-terracotta"
        )}
      >
        {xpOrHp}
      </p>
      {extras.length > 0 && (
        <ul className="flex flex-col gap-[3px]" aria-label={`${kind} details`}>
          {extras.map((e) => (
            <li
              key={e}
              className="font-sans text-[11px] text-muted-text flex items-center gap-1.5"
            >
              <span
                className={cn(
                  "w-[3px] h-[3px] rounded-full shrink-0",
                  isReward ? "bg-muted-emerald/60" : "bg-terracotta/60"
                )}
                aria-hidden="true"
              />
              {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Full modal content ───────────────────────────────────────────────────────

function ReviewDetailContent({ data, onClose }: { data: ReviewDetailData; onClose?: () => void }) {
  const isActive = data.status === "active";
  const isCompleted = data.status === "completed";
  const conditions = data.win_conditions ?? [];

  // Reward values — use detail data if available, fall back to spec defaults
  const rewardXp = data.reward_xp ?? 200;
  const rewardGold = data.reward_gold ?? 50;
  const penaltyHp = data.penalty_hp ?? 20;
  const penaltyEffects = data.penalty_effects ?? ["Shield destroyed"];

  const queryClient = useQueryClient();

  const claimMutation = useMutation({
    mutationFn: async () => {
      await apiFetchClient(`journey/rewards/claim`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journey"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "bootstrap"] });
      if (onClose) onClose();
    },
    onError: (err: any) => {
      alert(err.message || "Failed to claim rewards.");
    },
  });

  return (
    <>
      {/* ── Status row ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <StatusBadge status={data.status} />
        {isActive && data.days_remaining != null && (
          <UrgencyBar daysRemaining={data.days_remaining} />
        )}
      </div>

      {/* ── Score banner (completed only) ──────────────────────────── */}
      {isCompleted && data.score != null && (
        <ScoreBanner score={data.score} />
      )}

      {/* ── Objectives ─────────────────────────────────────────────── */}
      {conditions.length > 0 && (
        <ObjectivesSection conditions={conditions} />
      )}

      {/* ── Overall progress (active only) ─────────────────────────── */}
      {isActive && data.completion_percentage != null && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-text">
              Overall progress
            </span>
            <span className="font-sans text-[12px] font-medium text-pearl-text tabular-nums">
              {data.completion_percentage}%
            </span>
          </div>
          <Progress
            value={data.completion_percentage}
            max={100}
            colorVar="--color-muted-emerald"
            height="md"
            aria-label={`Overall review progress: ${data.completion_percentage}%`}
          />
        </div>
      )}

      {/* ── Outcome grid ───────────────────────────────────────────── */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6"
        aria-label="Review outcomes"
      >
        <OutcomeTile
          kind="reward"
          xpOrHp={`+${rewardXp} XP · +${rewardGold} Gold`}
          extras={["Progression stamp unlocked"]}
        />
        <OutcomeTile
          kind="penalty"
          xpOrHp={`−${penaltyHp} HP`}
          extras={penaltyEffects}
        />
      </div>

      {isCompleted && !data.rewards_claimed && (
        <button
          onClick={() => claimMutation.mutate()}
          disabled={claimMutation.isPending}
          className="w-full rounded-lg bg-muted-emerald px-4 py-3 font-sans text-sm font-bold text-abyssal-slate transition-colors hover:bg-muted-emerald/90 disabled:opacity-50"
        >
          {claimMutation.isPending ? "Claiming..." : "Claim Rewards"}
        </button>
      )}
    </>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReviewDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviewId: string;
  /** Optimistic summary from the review list */
  summary: QuarterlyReview;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReviewDetailModal({
  isOpen,
  onClose,
  reviewId,
  summary,
}: ReviewDetailModalProps) {
  const { data, isLoading, isError, refetch } = useReviewDetail({
    reviewId,
    summary,
  });

  const displayTitle = data?.title ?? summary.title;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={displayTitle} size="md">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <Modal.Header>
        <div className="flex flex-col gap-[3px]">
          {/* Quarter eyebrow */}
          {summary.quarter && (
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-text">
              {summary.quarter} Review
            </p>
          )}
          <h2
            className={[
              "font-display text-[19px] font-semibold",
              "text-pearl-text tracking-[-0.01em] leading-tight",
            ].join(" ")}
          >
            {displayTitle}
          </h2>
        </div>
      </Modal.Header>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <Modal.Body>
        {isLoading && !data ? (
          <ModalLoadingBody rows={6} />
        ) : isError ? (
          <ModalErrorBody onRetry={refetch} />
        ) : data ? (
          <ReviewDetailContent data={data} onClose={onClose} />
        ) : null}
      </Modal.Body>
    </Modal>
  );
}

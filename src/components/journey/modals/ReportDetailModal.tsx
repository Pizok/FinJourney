"use client";

import { Modal, ModalLoadingBody, ModalErrorBody } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { useQuarterlyReportSummary } from "@/components/journey/hooks/useQuarterlyReportSummary";
import type { QuarterlyReportListItem, QuarterlyReportSummary } from "@/components/journey/types/journey.types";
import { TrendingUp, TrendingDown, CheckCircle, XCircle } from "lucide-react";

interface ReportDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: QuarterlyReportListItem;
}

function ReportDetailContent({ data }: { data: QuarterlyReportSummary }) {
  const isPositive = data.net_change >= 0;

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Net Change Section */}
        <div className="flex flex-col gap-2 p-4 rounded-lg bg-abyssal-slate border border-tactical-border">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-text">
            Net Wealth Change
          </p>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-display text-[24px] font-semibold tabular-nums",
                isPositive ? "text-muted-emerald" : "text-terracotta"
              )}
            >
              {isPositive ? "+" : ""}{data.net_change.toLocaleString()}
            </span>
            {isPositive ? (
              <TrendingUp size={20} className="text-muted-emerald" />
            ) : (
              <TrendingDown size={20} className="text-terracotta" />
            )}
          </div>
          <div className="flex justify-between mt-2 font-sans text-[13px]">
            <span className="text-muted-text">Income:</span>
            <span className="text-pearl-text tabular-nums">{data.total_income.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-sans text-[13px]">
            <span className="text-muted-text">Expenses:</span>
            <span className="text-pearl-text tabular-nums">{data.total_expenses.toLocaleString()}</span>
          </div>
        </div>

        {/* Challenges Section */}
        {data.challenges_summary.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-text">
              Challenges
            </p>
            {data.challenges_summary.map((ch) => (
              <div key={ch.id} className="flex items-center justify-between p-3 rounded-lg border border-tactical-border bg-canvas-surface/50">
                <span className="font-sans text-[13px] text-pearl-text">{ch.title}</span>
                {ch.achieved ? (
                  <CheckCircle size={16} className="text-muted-emerald" />
                ) : (
                  <XCircle size={16} className="text-terracotta" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Spending by Category */}
        {data.spending_by_category.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-text">
              Spending Categories
            </p>
            {data.spending_by_category.map((cat) => (
              <div key={cat.category_id} className="flex items-center justify-between p-3 rounded-lg border border-tactical-border bg-canvas-surface/50">
                <div className="flex flex-col">
                  <span className="font-sans text-[13px] text-pearl-text">{cat.category_name}</span>
                  {cat.overspend_months_count > 0 && (
                    <span className="font-sans text-[11px] text-terracotta mt-1">
                      Overspent {cat.overspend_months_count} month{cat.overspend_months_count > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <span className="font-sans text-[13px] font-medium tabular-nums text-pearl-text">
                  {cat.total_spend.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Behavioral Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 p-3 rounded-lg border border-tactical-border bg-canvas-surface/50">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-text">
              Zero Spend Days
            </p>
            <span className="font-display text-[18px] font-semibold text-pearl-text">
              {data.zero_spend_days}
            </span>
          </div>
          <div className="flex flex-col gap-1 p-3 rounded-lg border border-tactical-border bg-canvas-surface/50">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-text">
              Longest Streak
            </p>
            <span className="font-display text-[18px] font-semibold text-pearl-text">
              {data.longest_streak}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

export function ReportDetailModal({
  isOpen,
  onClose,
  report,
}: ReportDetailModalProps) {
  const { data, isLoading, isError, refetch } = useQuarterlyReportSummary(
    report.year,
    report.quarter,
    isOpen
  );

  const displayTitle = `Q${report.quarter} ${report.year} Report`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={displayTitle} size="md">
      <Modal.Header>
        <div className="flex flex-col gap-[3px]">
          {report.is_partial && (
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-text">
              Partial Quarter
            </p>
          )}
          <h2 className="font-display text-[19px] font-semibold text-pearl-text tracking-[-0.01em] leading-tight">
            {displayTitle}
          </h2>
        </div>
      </Modal.Header>

      <Modal.Body>
        {isLoading && !data ? (
          <ModalLoadingBody rows={6} />
        ) : isError ? (
          <ModalErrorBody onRetry={refetch} />
        ) : data ? (
          <ReportDetailContent data={data} />
        ) : null}
      </Modal.Body>
    </Modal>
  );
}

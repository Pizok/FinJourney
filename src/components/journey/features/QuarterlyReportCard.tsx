"use client";

import { FileText, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { QuarterlyReportListItem } from "@/components/journey/types/journey.types";

export interface QuarterlyReportCardProps {
  report: QuarterlyReportListItem;
  onClick: (report: QuarterlyReportListItem) => void;
}

export function QuarterlyReportCard({ report, onClick }: QuarterlyReportCardProps) {
  const isPositive = report.net_change >= 0;
  
  return (
    <Card
      interactive
      padding="none"
      className="transition-opacity duration-200 opacity-[0.85] hover:opacity-100"
      onClick={() => onClick(report)}
      role="button"
      tabIndex={0}
      aria-label={`Q${report.quarter} ${report.year} Report`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(report);
        }
      }}
    >
      <div className="p-5">
        <div className="flex items-start gap-3">
          {/* Icon container */}
          <div
            className={cn(
              "flex items-center justify-center shrink-0",
              "w-9 h-9 rounded-lg border",
              "text-muted-text bg-tactical-border/20 border-tactical-border/40"
            )}
            aria-hidden="true"
          >
            <FileText size={14} strokeWidth={2} />
          </div>

          {/* Title + detail row */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-[5px]">
              <span className="font-display text-[15px] font-semibold text-pearl-text leading-tight truncate">
                Q{report.quarter} {report.year} Report
              </span>
              {report.is_partial && (
                <Badge variant="muted">Partial</Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-[3px]",
                  "font-sans text-[12px] font-medium tabular-nums",
                  isPositive ? "text-muted-emerald" : "text-terracotta"
                )}
              >
                {isPositive ? (
                  <TrendingUp size={11} strokeWidth={2} />
                ) : (
                  <TrendingDown size={11} strokeWidth={2} />
                )}
                {isPositive ? "+" : ""}{report.net_change.toLocaleString()}
              </span>
            </div>
          </div>

          <ChevronRight
            size={15}
            strokeWidth={2}
            className="text-muted-text shrink-0 mt-[2px]"
            aria-hidden="true"
          />
        </div>
      </div>
    </Card>
  );
}

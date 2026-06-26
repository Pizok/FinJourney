"use client";

import { Progress } from "@/components/ui/Progress";

export interface MapProgressProps {
  currentXp: number;
  currentNodeId: string;
  thresholds: Record<string, number>;
}

export function MapProgress({ currentXp, currentNodeId, thresholds }: MapProgressProps) {
  // Use a ternary fallback/Math.max guard to prevent division by zero
  const threshold = Math.max(1, thresholds[currentNodeId] || 1);
  
  // Calculate percentage capped at 100%
  const progressPct = Math.min(100, Math.round((currentXp / threshold) * 100));

  return (
    <div className="flex flex-col gap-1.5 mt-4">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[12px] text-muted-text">
          Progress to Next Node
        </span>
        <span className="font-sans text-[12px] font-medium text-pearl-text tabular-nums">
          {currentXp} / {threshold} XP
        </span>
      </div>
      <Progress
        value={currentXp}
        max={threshold}
        colorVar="--color-dawn-gold"
        height="sm"
        aria-label={`Node XP progress: ${currentXp} of ${threshold}`}
      />
    </div>
  );
}

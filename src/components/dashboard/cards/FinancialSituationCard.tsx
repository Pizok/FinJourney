'use client';

import { CircleDot, AlertTriangle, PauseCircle } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';

// ─── Status Variants ───────────────────────────────────────────────────────────

type StatusVariant = 'stable' | 'ghost' | 'standby';

interface StatusConfig {
  variant: StatusVariant;
  icon: React.ElementType;
  iconClass: string;
  dotClass: string;
  label: string;
  message: string;
}

function resolveStatus(
  ghostWarning: boolean,
  ghostPenaltyActive: boolean,
  standbyActive: boolean
): StatusConfig {
  if (ghostPenaltyActive || ghostWarning) {
    return {
      variant: 'ghost',
      icon: AlertTriangle,
      iconClass: 'text-terracotta',
      dotClass: 'bg-terracotta',
      label: 'Ghost Warning',
      message:
        'Activity missing. Log today\u2019s spending to protect your progress.',
    };
  }
  if (standbyActive) {
    return {
      variant: 'standby',
      icon: PauseCircle,
      iconClass: 'text-steel-violet',
      dotClass: 'bg-steel-violet',
      label: 'Standby Active',
      message:
        'Standby Mode active. Progress and penalties paused for 24 hours.',
    };
  }
  return {
    variant: 'stable',
    icon: CircleDot,
    iconClass: 'text-muted-emerald',
    dotClass: 'bg-muted-emerald',
    label: 'Stable',
    message: 'Stable. No major financial risks detected today.',
  };
}

// ─── Card ──────────────────────────────────────────────────────────────────────

export function FinancialSituationCard() {
  const { data } = useDashboardData();
  const { daily_status } = data;

  const status = resolveStatus(
    daily_status.ghost_warning,
    daily_status.ghost_penalty_active,
    daily_status.standby_active
  );

  const Icon = status.icon;

  return (
    <article className="bg-canvas-surface border border-tactical-border rounded-xl p-6 h-full flex flex-col gap-5">
      {/* Header */}
      <h2 className="font-display text-sm font-semibold text-pearl-text uppercase tracking-widest">
        System Status
      </h2>

      {/* Status block */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">
          <Icon
            size={16}
            strokeWidth={2}
            className={`${status.iconClass} flex-shrink-0`}
          />
        </div>
        <p className="font-sans text-sm text-pearl-text leading-relaxed">
          {status.message}
        </p>
      </div>

      {/* Streak count — only when stable */}
      {status.variant === 'stable' && daily_status.streak_count > 0 && (
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-muted-emerald flex-shrink-0" />
          <span className="font-sans text-xs text-muted-text">
            {daily_status.streak_count}-day streak
          </span>
        </div>
      )}

      {/* Action hint — always shown */}
      <p className="font-sans text-xs text-muted-text leading-relaxed mt-auto pt-3 border-t border-tactical-border">
        Log a transaction or mark a zero-spend day.
      </p>
    </article>
  );
}

'use client';

import Image from 'next/image';
import { Shield, CheckSquare, Flame, CheckCircle2 } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { hpBarColor, clampPercent, formatCurrency, initial } from '../utils/dashboard.helpers';

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatBar({
  label,
  value,
  max,
  percent,
  barClass,
  detail,
}: {
  label: string;
  value: number;
  max?: number;
  percent: number;
  barClass: string;
  detail?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-sans text-xs uppercase tracking-widest text-muted-text">
          {label}
        </span>
        <span className="font-sans text-xs text-muted-text">
          {detail ?? (max !== undefined ? `${value} / ${max}` : value)}
        </span>
      </div>
      <div
        className="h-1.5 rounded-full bg-abyssal-slate overflow-hidden"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${barClass}`}
          style={{ width: `${clampPercent(percent)}%` }}
        />
      </div>
    </div>
  );
}

function SmallStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-abyssal-slate border border-tactical-border flex items-center justify-center flex-shrink-0">
        <Icon size={13} strokeWidth={2} className="text-muted-text" />
      </div>
      <div>
        <p className="font-sans text-[10px] uppercase tracking-widest text-muted-text leading-none mb-0.5">
          {label}
        </p>
        <p className="font-sans text-sm font-medium text-pearl-text">{value}</p>
      </div>
    </div>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────────

export function ProfileVitalsCard() {
  const { data } = useDashboardData();
  const { profile, player_state, daily_status } = data;

  const hpPercent = clampPercent(
    (player_state.hp / player_state.hp_max) * 100
  );
  const hpColor = hpBarColor(player_state.hp);
  const isLowHp = player_state.hp < 30;

  const xpLabel = `${player_state.xp.toLocaleString('id-ID')} XP`;

  return (
    <article className="bg-canvas-surface border border-tactical-border rounded-xl p-6 h-full space-y-5">
      {/* User Identity Header */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-abyssal-slate border border-tactical-border flex items-center justify-center flex-shrink-0 overflow-hidden">
          <Image 
            src={`/avatar/${profile.avatar_key || 'Roan'}.png`} 
            alt={profile.avatar_key || 'Roan'} 
            width={40} 
            height={40} 
            className="object-cover"
          />
        </div>
        <div className="min-w-0">
          <p className="font-sans text-sm text-pearl-text font-medium truncate">
            {profile.username}
          </p>
          <p className="font-sans text-xs text-muted-text truncate">
            {profile.avatar_key || 'Explorer'}
          </p>
        </div>
        {/* Level badge */}
        <span className="ml-auto font-display text-xs font-semibold text-dawn-gold border border-dawn-gold/30 rounded px-2 py-0.5 flex-shrink-0">
          Lv {profile.level}
        </span>
      </div>

      {/* HP Bar */}
      <StatBar
        label="HP"
        value={player_state.hp}
        max={player_state.hp_max}
        percent={hpPercent}
        barClass={hpColor}
      />

      {/* Low HP Warning */}
      {isLowHp && (
        <p className="font-sans text-xs text-terracotta -mt-2">
          Warning: Financial stability critical.
        </p>
      )}

      {/* XP (Text Only) */}
      <div className="flex items-center justify-between">
        <span className="font-sans text-xs uppercase tracking-widest text-muted-text">
          XP
        </span>
        <span className="font-sans text-xs text-muted-text">
          {xpLabel}
        </span>
      </div>

      {/* Shield + Streak */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <SmallStat
          icon={Shield}
          label="Shield"
          value={String(player_state.shield)}
        />
        <SmallStat
          icon={Flame}
          label="Streak"
          value={`${player_state.current_streak || 0} days`}
        />
      </div>

      {/* Daily Log Status */}
      <div className="flex flex-col gap-2 pt-3 border-t border-tactical-border">
        <div className="flex items-center gap-2">
          <CheckSquare size={14} strokeWidth={2} className="text-muted-text flex-shrink-0" />
          <span className="font-sans text-xs text-muted-text">
            Daily XP Opportunities:
          </span>
        </div>
        <div className="pl-6 flex flex-col gap-1.5">
          <div className="flex items-start gap-2">
            <CheckCircle2 
              size={12} 
              strokeWidth={2.5} 
              className={`mt-0.5 flex-shrink-0 ${
                daily_status.expense_logged_today || daily_status.zero_spend_marked 
                  ? 'text-muted-emerald' 
                  : 'text-muted-text/50'
              }`} 
            />
            <span className={`font-sans text-[11px] leading-tight ${
              daily_status.expense_logged_today || daily_status.zero_spend_marked 
                ? 'text-muted-emerald line-through opacity-80' 
                : 'text-muted-text'
            }`}>
              Log an expense (or Zero-Spend) to earn +5 XP
            </span>
          </div>
          
          <div className="flex items-start gap-2">
            <CheckCircle2 
              size={12} 
              strokeWidth={2.5} 
              className={`mt-0.5 flex-shrink-0 ${
                daily_status.income_logged_today
                  ? 'text-muted-emerald' 
                  : 'text-muted-text/50'
              }`} 
            />
            <span className={`font-sans text-[11px] leading-tight ${
                daily_status.income_logged_today
                  ? 'text-muted-emerald line-through opacity-80' 
                  : 'text-muted-text'
            }`}>
              Log an income today to earn +5 XP
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

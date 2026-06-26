'use client';

import { Clock, Swords, CheckCircle2 } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { pluralise } from '../utils/dashboard.helpers';
import { getChallengeColor } from '@/lib/challenge-colors';

// ─── Active Challenge ──────────────────────────────────────────────────────────

function ActiveChallenge({
  title,
  description,
  days_remaining,
  icon,
  color,
}: {
  title: string;
  description: string;
  days_remaining: number | null;
  icon: string;
  color: string;
}) {
  const c = getChallengeColor(color);
  const [prefix, ...rest] = title.split(':');
  const suffix = rest.join(':').trim();

  return (
    <div className="flex flex-col h-full">
      {/* Top row: label + status badge + icon pill */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <span className="font-sans text-xs uppercase tracking-widest text-muted-text">
          {prefix}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 font-sans text-xs text-muted-emerald border border-muted-emerald/30 rounded-full px-2.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-emerald" />
            Review active
          </span>
          <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${c.iconBg}`}>
            <i className={`${icon} text-base ${c.iconText}`} aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Challenge title */}
      <h2 className="font-display text-2xl font-semibold text-pearl-text leading-tight mb-3">
        {suffix}
      </h2>

      {/* Description */}
      <p className="font-sans text-sm text-muted-text leading-relaxed max-w-prose flex-1">
        {description}
      </p>

      {/* Footer: countdown */}
      <div className="mt-6 flex items-center gap-2">
        <Clock size={14} strokeWidth={2} className="text-muted-text" />
        <span className="font-sans text-sm text-muted-text">
          {days_remaining !== null
            ? pluralise(days_remaining, 'day') + ' remaining'
            : 'Ongoing'}
        </span>
      </div>
    </div>
  );
}

// ─── Idle State ────────────────────────────────────────────────────────────────

function IdleState() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-5">
        <CheckCircle2 size={16} strokeWidth={2} className="text-muted-emerald" />
        <span className="font-sans text-xs uppercase tracking-widest text-muted-text">
          Current Status
        </span>
      </div>
      <h2 className="font-display text-2xl font-semibold text-pearl-text mb-3">
        Journey Stable
      </h2>
      <p className="font-sans text-sm text-muted-text leading-relaxed max-w-prose flex-1">
        Your finances are currently stable. Continue logging daily activity to
        maintain momentum and earn XP.
      </p>
    </div>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────────

export function CurrentChallengeCard() {
  const { data } = useDashboardData();
  const challenge = data.active_challenge;
  const isActive = challenge?.status === 'active';

  return (
    <article
      className={[
        'bg-canvas-surface rounded-xl p-6 h-full min-h-[180px]',
        'border transition-colors duration-200',
        isActive ? 'border-muted-emerald/20' : 'border-tactical-border',
      ].join(' ')}
    >
      {/* Renderer-driven illustration placeholder */}
      {challenge?.asset_key && (
        <div
          className="absolute inset-0 rounded-xl overflow-hidden opacity-5 pointer-events-none"
          aria-hidden="true"
          data-asset-key={challenge.asset_key}
        />
      )}

      {isActive && challenge ? (
        <ActiveChallenge
          title={challenge.title}
          description={challenge.description}
          days_remaining={challenge.days_remaining}
          icon={challenge.icon ?? 'ti-sword'}
          color={challenge.color ?? 'gray'}
        />
      ) : (
        <IdleState />
      )}
    </article>
  );
}

'use client';

import { Clock, CheckCircle2, Hourglass } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { pluralise, clampPercent, formatCurrency } from '../utils/dashboard.helpers';
import { getChallengeColor } from '@/lib/challenge-colors';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const TASK_LABELS: Record<string, string> = {
  add_wallet: 'Create a wallet',
  update_category: 'Set a category limit',
  catch_up_payment_made: 'Make catch-up payment',
  all_payments_made: 'Make all scheduled payments',
};

function formatTaskLabel(key: string): string {
  if (TASK_LABELS[key]) return TASK_LABELS[key];
  // Fallback: replace underscores with spaces and title-case
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ─── Active Challenge ──────────────────────────────────────────────────────────

function ActiveChallenge({
  title,
  description,
  days_remaining,
  icon,
  color,
  progress_data,
  type,
}: {
  title: string;
  description: string;
  days_remaining: number | null;
  icon: string;
  color: string;
  progress_data: any;
  type: string;
}) {
  const c = getChallengeColor(color);
  const [prefix, ...rest] = title.split(':');
  const suffix = rest.join(':').trim() || prefix; // Fallback if no colon
  const displayPrefix = rest.length > 0 ? prefix : 'Challenge';

  return (
    <div className={`flex flex-col h-full relative p-6 rounded-xl overflow-hidden ${c.bg}`}>
      {/* Top row: label + status badge + icon pill */}
      <div className="flex items-start justify-between gap-4 mb-5 relative z-10">
        <span className="font-sans text-xs uppercase tracking-widest text-muted-text">
          {displayPrefix}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 font-sans text-xs text-muted-emerald border border-muted-emerald/30 rounded-full px-2.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-emerald" />
            Active
          </span>
          <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${c.iconBg}`}>
            <i className={`ti ${icon} text-base ${c.iconText}`} aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Challenge title */}
      <h2 className="font-display text-2xl font-semibold text-pearl-text leading-tight mb-3 drop-shadow-sm relative z-10">
        {suffix}
      </h2>

      {/* Description */}
      <p className="font-sans text-sm text-muted-text leading-relaxed max-w-prose flex-1 mb-5 relative z-10">
        {description}
      </p>

      {/* Dynamic Progress UI */}
      <div className="mb-6 relative z-10">
        {type === 'FIRST_STEPS' && progress_data?.tasks ? (
          // Legacy hardcoded FIRST_STEPS tasks (with count)
          <ul className="space-y-2">
            <li className="flex items-center gap-3">
              <CheckCircle2 size={16} strokeWidth={2} className={progress_data.tasks.add_wallet ? "text-muted-emerald" : "text-muted-text/30"} />
              <span className={`font-sans text-sm ${progress_data.tasks.add_wallet ? "text-pearl-text line-through opacity-70" : "text-muted-text"}`}>
                Create a wallet{progress_data.tasks.add_wallet && " (Done)"}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 size={16} strokeWidth={2} className={progress_data.tasks.update_category ? "text-muted-emerald" : "text-muted-text/30"} />
              <span className={`font-sans text-sm ${progress_data.tasks.update_category ? "text-pearl-text line-through opacity-70" : "text-muted-text"}`}>
                Set a category limit{progress_data.tasks.update_category && " (Done)"}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 size={16} strokeWidth={2} className={(progress_data.count ?? 0) >= 10 ? "text-muted-emerald" : "text-muted-text/30"} />
              <span className={`font-sans text-sm ${(progress_data.count ?? 0) >= 10 ? "text-pearl-text line-through opacity-70" : "text-muted-text"}`}>
                Log your first 10 transactions ({Math.min(progress_data.count ?? 0, 10)}/10){(progress_data.count ?? 0) >= 10 && " (Done)"}
              </span>
            </li>
          </ul>
        ) : progress_data && 'target_streak' in progress_data ? (
          // Streak Challenges
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-sans text-xs uppercase tracking-widest text-muted-text">Progress</span>
              <span className="font-sans text-xs text-muted-text">{progress_data.current_streak} / {progress_data.target_streak} Days</span>
            </div>
            <div className="h-1.5 rounded-full bg-abyssal-slate overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 bg-current ${c.iconText}`} style={{ width: `${clampPercent((progress_data.current_streak / progress_data.target_streak) * 100)}%` }} />
            </div>
          </div>
        ) : progress_data && 'target_amount' in progress_data ? (
          // Amount Challenges
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-sans text-xs uppercase tracking-widest text-muted-text">Progress</span>
              <span className="font-sans text-xs text-muted-text">{formatCurrency(progress_data.amount)} / {formatCurrency(progress_data.target_amount)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-abyssal-slate overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 bg-current ${c.iconText}`} style={{ width: `${clampPercent((progress_data.amount / progress_data.target_amount) * 100)}%` }} />
            </div>
          </div>
        ) : progress_data && 'tasks' in progress_data ? (
          // Task List Challenges
          <ul className="space-y-2">
            {Object.entries(progress_data.tasks).map(([key, isDone]) => (
              <li key={key} className="flex items-center gap-3">
                <CheckCircle2 size={16} strokeWidth={2} className={isDone ? "text-muted-emerald" : "text-muted-text/30"} />
                <span className={`font-sans text-sm ${isDone ? "text-pearl-text line-through opacity-70" : "text-muted-text"}`}>
                  {formatTaskLabel(key)}{Boolean(isDone) && " (Done)"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          // Fallback (Rest Challenges, etc.)
          null
        )}
      </div>

      {/* Footer: countdown */}
      <div className="mt-auto flex items-center gap-2 relative z-10">
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
  const c = getChallengeColor('gray');

  return (
    <div className="flex flex-col h-full relative">
      {/* Top row: label + status badge + icon pill */}
      <div className="flex items-start justify-between gap-4 mb-5 relative z-10">
        <span className="font-sans text-xs uppercase tracking-widest text-muted-text">
          Current Status
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`inline-flex items-center gap-1.5 font-sans text-xs border rounded-full px-2.5 py-0.5 ${c.badge} ${c.badgeText}`}>
            <span className={`w-1.5 h-1.5 rounded-full bg-current ${c.iconText}`} />
            Standby
          </span>
          <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${c.iconBg}`}>
            <i className={`ti ti-hourglass text-base ${c.iconText}`} aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Challenge title */}
      <h2 className="font-display text-2xl font-semibold text-pearl-text leading-tight mb-3 drop-shadow-sm relative z-10">
        Awaiting Next Challenge
      </h2>

      {/* Description */}
      <p className="font-sans text-sm text-muted-text leading-relaxed max-w-prose flex-1 mb-5 relative z-10">
        There are no active challenges at the moment. Continue logging your daily activity until the system assigns your next objective.
      </p>

      {/* Footer */}
      <div className="mt-auto flex items-center gap-2 relative z-10">
        <Hourglass size={14} strokeWidth={2} className="text-muted-text" />
        <span className="font-sans text-sm text-muted-text">
          Monitoring triggers...
        </span>
      </div>
    </div>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────────

export function CurrentChallengeCard() {
  const { data } = useDashboardData();
  const challenge = data.active_challenge;
  const isActive = challenge?.status === 'ACTIVE';

  return (
    <article
      className={[
        'bg-canvas-surface rounded-xl h-full min-h-[180px]',
        'border transition-colors duration-200 relative',
        isActive ? 'border-muted-emerald/20' : 'border-tactical-border p-6',
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
          progress_data={challenge.progress_data}
          type={challenge.type}
        />
      ) : (
        <IdleState />
      )}
    </article>
  );
}

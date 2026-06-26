'use client';
// components/onboarding/OnboardingCard.tsx
//
// Shared card shell every step wraps itself in.
// Canvas Surface (#1E293B) · 1px Tactical Border · rounded-xl · p-8
//
// Also exports the small primitive elements (LabelTag, SectionTitle, etc.)
// so every step file speaks a consistent visual language without re-inventing.

import React from 'react';
import { ChevronLeft, ArrowRight } from 'lucide-react';

// ── Card shell ────────────────────────────────────────────────────────────

interface OnboardingCardProps {
  children: React.ReactNode;
  className?: string;
}

export function OnboardingCard({ children, className = '' }: OnboardingCardProps) {
  return (
    <div
      className={[
        'mx-auto w-full max-w-[540px]',
        'bg-canvas-surface border border-tactical-border rounded-xl',
        'p-8',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

// ── Label tag (small uppercase accent line) ───────────────────────────────

export function LabelTag({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-4">
      <span className="w-1.5 h-1.5 rounded-full bg-muted-emerald" />
      <span className="text-[11px] font-medium tracking-[0.07em] uppercase text-muted-emerald font-sans">
        {children}
      </span>
    </div>
  );
}

// ── Step heading ─────────────────────────────────────────────────────────

export function StepHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[26px] font-semibold text-pearl-text leading-snug mb-2">
      {children}
    </h2>
  );
}

// ── Subtitle / supporting copy ────────────────────────────────────────────

export function StepSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] text-muted-text leading-relaxed mb-10 max-w-[42ch]">
      {children}
    </p>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────

export function Divider() {
  return <div className="h-px bg-tactical-border my-8" />;
}

// ── Primary button ────────────────────────────────────────────────────────

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function PrimaryButton({
  children,
  icon = <ArrowRight size={15} strokeWidth={2} />,
  fullWidth = true,
  className = '',
  ...rest
}: PrimaryButtonProps) {
  return (
    <button
      className={[
        'flex items-center justify-center gap-2',
        'bg-muted-emerald text-pearl-text rounded-lg',
        'px-6 py-[13px] text-[15px] font-medium font-sans',
        'transition-opacity duration-150 hover:opacity-85',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
      {icon}
    </button>
  );
}

// ── Ghost / back button ───────────────────────────────────────────────────

interface GhostButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  showBack?: boolean;
}

export function GhostButton({
  children,
  showBack = false,
  className = '',
  ...rest
}: GhostButtonProps) {
  return (
    <button
      className={[
        'flex items-center gap-1.5 text-[14px] text-muted-text font-sans',
        'transition-colors duration-150 hover:text-pearl-text',
        'bg-transparent border-none p-0',
        className,
      ].join(' ')}
      {...rest}
    >
      {showBack && <ChevronLeft size={15} strokeWidth={2} />}
      {children}
    </button>
  );
}

// ── Button row (back left / primary right) ────────────────────────────────

interface ButtonRowProps {
  onBack?: () => void;
  backLabel?: string;
  primaryLabel: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
}

export function ButtonRow({
  onBack,
  backLabel = 'Back',
  primaryLabel,
  onPrimary,
  primaryDisabled,
}: ButtonRowProps) {
  return (
    <div className="flex items-center justify-between mt-8">
      {onBack ? (
        <GhostButton showBack onClick={onBack}>{backLabel}</GhostButton>
      ) : (
        <span />
      )}
      <PrimaryButton fullWidth={false} onClick={onPrimary} disabled={primaryDisabled}>
        {primaryLabel}
      </PrimaryButton>
    </div>
  );
}

// ── Budget callout (teal-tinted, used on Baseline + Review) ───────────────

interface BudgetCalloutProps {
  dailyBudget: number;
  currency?: string;
  /** Optional sub-line, e.g. the formula breakdown */
  sub?: string;
}

export function BudgetCallout({ dailyBudget, currency = 'Rp', sub }: BudgetCalloutProps) {
  const formatted = dailyBudget.toLocaleString('id-ID', {
    maximumFractionDigits: 0,
  });

  return (
    <div className="mt-6 rounded-lg border border-muted-emerald/25 bg-muted-emerald/[0.06] px-6 py-5">
      <p className="text-[11px] font-medium tracking-[0.07em] uppercase text-muted-emerald mb-1.5">
        Daily budget
      </p>
      <p className="font-display text-[32px] font-semibold text-pearl-text leading-none">
        {currency} {formatted}
      </p>
      {sub && (
        <p className="text-[13px] text-muted-text mt-1">{sub}</p>
      )}
    </div>
  );
}

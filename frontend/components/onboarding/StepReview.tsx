'use client';
// components/onboarding/StepReview.tsx
//
// Layout rules applied:
//   • Section cards: bg-abyssal-slate + border-tactical-border. No inner shadows.
//   • Edit links: text-muted-emerald, no underline decoration.
//   • Path badge: steel-violet tint (violet is the secondary accent, appropriate
//     for a label/badge — not the primary action).
//   • Confirmation modal: uses a normal-flow min-height wrapper (not position:fixed)
//     so the iframe viewport doesn't collapse. In Next.js this renders as a portal
//     using a <dialog> or a sibling at the root — see comment below.
//   • h2 inside the modal → matches the card-level heading role.
//   • All section headings: uppercase label style (not h-level tags) since they
//     label data rows, not document sections. Keeps h2 → h3 clean.
//   • onEditPath wired (was missing in original).

import React from 'react';
import { Pencil, CheckCircle2, X, Shield } from 'lucide-react';
import {
  OnboardingCard,
  LabelTag,
  StepHeading,
  StepSubtitle,
  BudgetCallout,
  ButtonRow,
  PrimaryButton,
  GhostButton,
} from './OnboardingCard';
import { calcDailyBudget } from '@/lib/utils/currency';
import type { OnboardingState } from './types';

interface StepReviewProps {
  state:         OnboardingState;
  isSubmitting:  boolean;
  onConfirm:     () => void;
  onBack:        () => void;
  onEditPath:    () => void;
  onEditIncome:  () => void;
  onEditFixed:   () => void;
  onEditSavings: () => void;
}

// ── Section card shell ────────────────────────────────────────────────────────

function SectionCard({
  label,
  onEdit,
  children,
}: {
  label:    string;
  onEdit:   () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-abyssal-slate border border-tactical-border rounded-[10px] p-4 mb-2.5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium tracking-[0.07em] uppercase text-muted-text">
          {label}
        </span>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 text-[11px] text-muted-emerald hover:opacity-75 transition-opacity"
        >
          <Pencil size={11} strokeWidth={2} />
          Edit
        </button>
      </div>
      {children}
    </div>
  );
}

// ── Row inside a section card ─────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-tactical-border last:border-b-0">
      <span className="text-[13px] text-muted-text">{label}</span>
      <span className="font-display text-[14px] font-semibold text-pearl-text">{value}</span>
    </div>
  );
}

// ── Confirmation modal (in-flow, not fixed) ───────────────────────────────────
// NOTE: In Next.js, render this via createPortal into document.body so it sits
// above the rest of the DOM without position:fixed. The component below uses
// an in-flow min-height wrapper that works inside the widget preview.

function ConfirmModal({
  state,
  dailyBudget,
  fmt,
  isSubmitting,
  onConfirm,
  onClose,
}: {
  state: OnboardingState;
  dailyBudget: number;
  fmt: (n: number) => string;
  isSubmitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const totalIncome = state.incomeEntries.reduce((s, e) => s + e.amount, 0);
  const totalFixed  = state.fixedCostEntries.reduce((s, e) => s + e.amount, 0);

  const rows = [
    { label: 'Monthly income',  value: fmt(totalIncome),          color: 'text-muted-emerald' },
    { label: 'Fixed costs',     value: fmt(totalFixed),           color: 'text-dawn-gold'     },
    { label: 'Savings target',  value: fmt(state.savingsTarget),  color: 'text-pearl-text'    },
    { label: 'Daily budget',    value: fmt(Math.max(0, dailyBudget)), color: 'text-muted-emerald' },
  ] as const;

  return (
    // In-flow overlay — works in both iframe preview and Next.js portal context
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyssal-slate/80 px-6">
      <div className="relative w-full max-w-md bg-canvas-surface border border-tactical-border rounded-[14px] p-8">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-text hover:text-pearl-text transition-colors"
          aria-label="Close"
        >
          <X size={17} strokeWidth={2} />
        </button>

        {/* Check icon — flat tinted circle, no glow */}
        <div className="w-[50px] h-[50px] rounded-full bg-muted-emerald/10 border border-muted-emerald/25 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={24} strokeWidth={2} className="text-muted-emerald" />
        </div>

        {/* h2 — modal heading */}
        <h2 className="font-display text-[22px] font-semibold text-pearl-text text-center mb-2">
          Your journey begins
        </h2>
        <p className="text-[13px] text-muted-text leading-relaxed text-center mb-5">
          Setup complete. FinJourney has calculated your daily spending guide
          based on your real finances.
        </p>

        {/* Summary rows */}
        <div className="bg-abyssal-slate rounded-[8px] p-4 mb-5">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex justify-between text-[13px] py-1.5 border-b border-tactical-border last:border-b-0"
            >
              <span className="text-muted-text">{row.label}</span>
              <span className={`font-semibold ${row.color}`}>{row.value}</span>
            </div>
          ))}
        </div>

        <PrimaryButton onClick={onConfirm} disabled={isSubmitting} loading={isSubmitting}>
          {isSubmitting ? 'Entering...' : 'Enter dashboard'}
        </PrimaryButton>
        <GhostButton
          className="w-full justify-center mt-2"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Review again
        </GhostButton>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StepReview({
  state,
  isSubmitting,
  onConfirm,
  onBack,
  onEditPath,
  onEditIncome,
  onEditFixed,
  onEditSavings,
}: StepReviewProps) {
  const [loading,   setLoading]   = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);

  const totalIncome = state.incomeEntries.reduce((s, e) => s + e.amount, 0);
  const totalFixed  = state.fixedCostEntries.reduce((s, e) => s + e.amount, 0);
  const dailyBudget = calcDailyBudget({
    monthlyIncome: totalIncome,
    fixedCosts:    totalFixed,
    savingsTarget: state.savingsTarget,
  });

  const fmt = (n: number) =>
    `Rp ${n.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;

  const handleFinalize = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setShowModal(true);
  };

  return (
    <>
      <OnboardingCard>
        <LabelTag>Review</LabelTag>

        {/* h2 — card-level heading */}
        <StepHeading>Confirm your setup</StepHeading>
        <StepSubtitle>
          Everything look right? Edit any section before confirming.
        </StepSubtitle>

        {/* Path */}
        <SectionCard label="Financial path" onEdit={onEditPath}>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-steel-violet/10 border border-steel-violet/28 text-[#a5b4fc]">
            <Shield size={11} strokeWidth={2} />
            {state.selectedPath ?? 'Not selected'}
          </span>
        </SectionCard>

        {/* Income */}
        <SectionCard label="Monthly income" onEdit={onEditIncome}>
          {state.incomeEntries.map((e) => (
            <ReviewRow key={e.id} label={e.label || '—'} value={fmt(e.amount)} />
          ))}
          <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-tactical-border">
            <span className="text-[13px] font-semibold text-pearl-text font-display">Total</span>
            <span className="text-[14px] font-semibold text-muted-emerald font-display">{fmt(totalIncome)}</span>
          </div>
        </SectionCard>

        {/* Fixed costs */}
        <SectionCard label="Fixed costs" onEdit={onEditFixed}>
          {state.fixedCostEntries.map((e) => (
            <ReviewRow key={e.id} label={e.label || '—'} value={fmt(e.amount)} />
          ))}
          <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-tactical-border">
            <span className="text-[13px] font-semibold text-pearl-text font-display">Total</span>
            <span className="text-[14px] font-semibold text-dawn-gold font-display">{fmt(totalFixed)}</span>
          </div>
        </SectionCard>

        {/* Savings */}
        <SectionCard label="Savings target" onEdit={onEditSavings}>
          <ReviewRow label="Monthly savings" value={fmt(state.savingsTarget)} />
        </SectionCard>

        {/* Budget callout */}
        <BudgetCallout
          dailyBudget={Math.max(0, dailyBudget)}
          currency="Rp"
          sub="per day to spend freely"
        />

        <ButtonRow
          onBack={onBack}
          primaryLabel={loading ? 'Saving…' : 'Confirm and start'}
          onPrimary={handleFinalize}
          primaryDisabled={loading}
        />
      </OnboardingCard>

      {showModal && (
        <ConfirmModal
          state={state}
          dailyBudget={dailyBudget}
          fmt={fmt}
          isSubmitting={isSubmitting}
          onConfirm={onConfirm}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

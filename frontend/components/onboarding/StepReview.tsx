'use client';

// components/onboarding/StepReview.tsx

import React from 'react';
import { Pencil, CheckCircle2, X } from 'lucide-react';
import { Button }    from '@/components/ui/button';
import { SectionTag } from '@/components/ui/label';
import { calcDailyBudget } from '@/lib/utils/currency';
import type { OnboardingState } from './types';

interface StepReviewProps {
  state: OnboardingState;
  onConfirm: () => void;
  onBack: () => void;
  // Jump to a specific baseline sub-step to edit
  onEditIncome:  () => void;
  onEditFixed:   () => void;
  onEditSavings: () => void;
}

function SectionCard({
  title,
  onEdit,
  editLabel,
  children,
}: {
  title: string;
  onEdit: () => void;
  editLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-canvas border border-clean-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm text-muted-text uppercase tracking-widest">
          {title}
        </h3>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 text-xs font-sans text-refreshing-teal hover:opacity-80 transition-opacity cursor-pointer"
        >
          <Pencil size={12} strokeWidth={2} />
          {editLabel}
        </button>
      </div>
      {children}
    </div>
  );
}

export default function StepReview({
  state,
  onConfirm,
  onBack,
  onEditIncome,
  onEditFixed,
  onEditSavings,
}: StepReviewProps) {
  const [loading,  setLoading]  = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);

  const totalIncome  = state.incomeEntries.reduce((s, e) => s + e.amount, 0);
  const totalFixed   = state.fixedCostEntries.reduce((s, e) => s + e.amount, 0);
  const dailyBudget  = calcDailyBudget({
    monthlyIncome: totalIncome,
    fixedCosts:    totalFixed,
    savingsTarget: state.savingsTarget,
  });

  const fmt = (n: number) =>
    n.toLocaleString('id-ID', { maximumFractionDigits: 0 }) + ' IDR';

  const handleFinalize = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setShowModal(true);
  };

  return (
    <>
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <SectionTag>Review 4/4</SectionTag>
          <h1 className="font-display font-semibold text-3xl text-starlight-text tracking-tight">
            Confirm Your Financial Setup
          </h1>
          <p className="font-sans text-sm text-muted-text leading-relaxed max-w-md mx-auto">
            Review your numbers. FinJourney will use this to calculate your
            daily spending guide.
          </p>
        </div>

        {/* Income */}
        <SectionCard title="Monthly Income" onEdit={onEditIncome} editLabel="Adjust Income">
          <ul className="space-y-2">
            {state.incomeEntries.map((e) => (
              <li key={e.id} className="flex justify-between font-sans text-sm">
                <span className="text-muted-text">{e.label || '—'}</span>
                <span className="text-starlight-text">{fmt(e.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-clean-border pt-3">
            <span className="font-display font-semibold text-sm text-starlight-text">Total monthly income</span>
            <span className="font-display font-semibold text-refreshing-teal">{fmt(totalIncome)}</span>
          </div>
        </SectionCard>

        {/* Fixed Costs */}
        <SectionCard title="Monthly Essentials" onEdit={onEditFixed} editLabel="Adjust Expenses">
          <ul className="space-y-2">
            {state.fixedCostEntries.map((e) => (
              <li key={e.id} className="flex justify-between font-sans text-sm">
                <span className="text-muted-text">{e.label || '—'}</span>
                <span className="text-starlight-text">{fmt(e.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-clean-border pt-3">
            <span className="font-display font-semibold text-sm text-starlight-text">Total fixed costs</span>
            <span className="font-display font-semibold text-dawn-gold">{fmt(totalFixed)}</span>
          </div>
        </SectionCard>

        {/* Savings */}
        <SectionCard title="Savings Target" onEdit={onEditSavings} editLabel="Adjust Savings">
          <div className="flex justify-between">
            <span className="font-sans text-sm text-muted-text">Monthly savings target</span>
            <span className="font-display font-semibold text-starlight-text">{fmt(state.savingsTarget)}</span>
          </div>
        </SectionCard>

        {/* Daily budget highlight */}
        <div className="bg-midnight-sky border border-refreshing-teal/30 rounded-xl p-5 text-center space-y-1">
          <p className="font-sans text-xs text-muted-text uppercase tracking-widest">Your Daily Budget</p>
          <p className="font-display font-semibold text-4xl text-refreshing-teal">
            {fmt(Math.max(0, dailyBudget))}
          </p>
          <p className="font-sans text-xs text-muted-text">per day</p>
        </div>

        {/* CTAs */}
        <div className="flex gap-3">
          <Button variant="ghost" size="lg" className="flex-1" onClick={onBack}>
            Go Back
          </Button>
          <Button size="lg" className="flex-1" loading={loading} onClick={handleFinalize}>
            Finalize Setup &amp; Continue
          </Button>
        </div>
      </div>

      {/* ── Confirmation modal ───────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-sky/80 backdrop-blur-sm px-6">
          <div className="relative w-full max-w-md bg-slate-canvas border border-clean-border rounded-2xl p-8 space-y-6">
            {/* Close */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-muted-text hover:text-starlight-text transition-colors cursor-pointer"
            >
              <X size={18} strokeWidth={2} />
            </button>

            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-refreshing-teal/10 border border-refreshing-teal/30 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-refreshing-teal" strokeWidth={2} />
              </div>
            </div>

            {/* Text */}
            <div className="text-center space-y-3">
              <h2 className="font-display font-semibold text-2xl text-starlight-text tracking-tight">
                Your Journey Begins
              </h2>
              <p className="font-sans text-sm text-muted-text leading-relaxed">
                Your setup is complete. FinJourney has calculated your daily
                spending guide based on your real finances. You are now ready
                to start tracking your progress.
              </p>
            </div>

            {/* Summary list */}
            <div className="bg-midnight-sky rounded-xl p-4 space-y-2">
              {[
                { label: 'Monthly income',    value: fmt(totalIncome),          color: 'text-refreshing-teal' },
                { label: 'Fixed costs',       value: fmt(totalFixed),           color: 'text-dawn-gold'       },
                { label: 'Savings target',    value: fmt(state.savingsTarget),  color: 'text-starlight-text'  },
                { label: 'Daily budget',      value: fmt(Math.max(0, dailyBudget)), color: 'text-refreshing-teal' },
              ].map((row) => (
                <div key={row.label} className="flex justify-between font-sans text-sm">
                  <span className="text-muted-text">{row.label}</span>
                  <span className={`font-semibold ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Button size="lg" className="w-full" onClick={onConfirm}>
                Enter Dashboard
              </Button>
              <Button variant="ghost" size="md" className="w-full" onClick={() => setShowModal(false)}>
                Review Again
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

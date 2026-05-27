'use client';
// components/onboarding/StepBaseline.tsx
//
// Sub-steps: 3A (Income) → 3B (Fixed Costs) → 3C (Savings Target)
//
// Layout rules applied:
//   • Three sub-steps share one <OnboardingCard> shell; the visible section
//     swaps via `subStep` state. No page-level layout change between sub-steps.
//   • All inputs: flat bg-abyssal-slate, 1px tactical-border, focus → muted-emerald border.
//   • Running-total row uses muted-emerald (income) and dawn-gold (costs) for
//     semantic meaning only — not decoration.
//   • Budget preview uses the shared BudgetCallout primitive.
//   • Info note: flat abyssal-slate + tactical-border, no glow.
//   • Heading hierarchy: h2 for the step title, no h1 inside the card.
//   • jumpTo prop accepted and applied on mount so Review edits land correctly.

import React from 'react';
import { Info, Plus, Trash2 } from 'lucide-react';
import { Input }     from '@/components/ui/input';
import { FieldError } from '@/components/ui/label';
import { sanitizeCurrencyInput } from '@/lib/utils/currency';
import {
  OnboardingCard,
  LabelTag,
  StepHeading,
  StepSubtitle,
  BudgetCallout,
  ButtonRow,
} from './OnboardingCard';
import type { OnboardingState, BaselineEntry } from './types';

type SubStep = 'income' | 'fixed' | 'savings';

const SUB_ORDER: SubStep[] = ['income', 'fixed', 'savings'];

const LABELS: Record<SubStep, { tag: string; heading: string; sub: string }> = {
  income:  { tag: 'Baseline 1 of 3', heading: 'How much do you earn?',              sub: 'Enter your total monthly income from all sources.' },
  fixed:   { tag: 'Baseline 2 of 3', heading: 'What are your monthly essentials?',  sub: 'List the costs you must pay every month before anything else.' },
  savings: { tag: 'Baseline 3 of 3', heading: 'How much do you want to save?',       sub: 'Set aside money for your future before daily spending begins.' },
};

const uid = () => Math.random().toString(36).slice(2, 8);

// ── Entry list editor ────────────────────────────────────────────────────────

interface EntryListProps {
  entries: BaselineEntry[];
  errors:  Record<string, string>;
  onUpdate: (id: string, field: 'label' | 'amount', value: string | number) => void;
  onAdd:    () => void;
  onRemove: (id: string) => void;
  addLabel: string;
}

function EntryList({ entries, errors, onUpdate, onAdd, onRemove, addLabel }: EntryListProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {entries.map((entry) => (
        <div key={entry.id} className="flex gap-2.5 items-start">
          <div className="flex-1">
            <Input
              value={entry.label}
              onChange={(e) => onUpdate(entry.id, 'label', e.target.value)}
              placeholder="Description"
              error={!!errors[`label_${entry.id}`]}
            />
            {errors[`label_${entry.id}`] && (
              <FieldError message={errors[`label_${entry.id}`]} />
            )}
          </div>

          <div className="w-36">
            <Input
              value={entry.amount === 0 ? '' : String(entry.amount)}
              onChange={(e) =>
                onUpdate(entry.id, 'amount', Number(sanitizeCurrencyInput(e.target.value)) || 0)
              }
              placeholder="0"
              suffix="IDR"
              inputMode="numeric"
              error={!!errors[`amount_${entry.id}`]}
            />
          </div>

          {entries.length > 1 && (
            <button
              type="button"
              onClick={() => onRemove(entry.id)}
              className="mt-3 text-muted-text hover:text-terracotta transition-colors"
              aria-label="Remove entry"
            >
              <Trash2 size={15} strokeWidth={2} />
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1.5 text-[12px] font-sans text-muted-emerald hover:opacity-75 transition-opacity mt-0.5 w-fit"
      >
        <Plus size={13} strokeWidth={2} />
        {addLabel}
      </button>
    </div>
  );
}

// ── Inline info note ─────────────────────────────────────────────────────────

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 bg-abyssal-slate border border-tactical-border rounded-lg px-3.5 py-3 mb-5">
      <Info size={14} strokeWidth={2} className="text-muted-emerald flex-shrink-0 mt-[1px]" />
      <p className="text-[12px] text-muted-text leading-relaxed">{children}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface StepBaselineProps {
  state:     OnboardingState;
  onChange:  (patch: Partial<OnboardingState>) => void;
  onNext:    () => void;
  onBack:    () => void;
  /** Set by the Review screen's edit shortcuts */
  jumpTo?:   'income' | 'fixed' | 'savings' | null;
}

export default function StepBaseline({
  state,
  onChange,
  onNext,
  onBack,
  jumpTo,
}: StepBaselineProps) {
  const [subStep, setSubStep] = React.useState<SubStep>(jumpTo ?? 'income');
  const [errors,  setErrors]  = React.useState<Record<string, string>>({});

  // Apply jump target if the Review screen triggered an edit
  React.useEffect(() => {
    if (jumpTo) setSubStep(jumpTo);
  }, [jumpTo]);

  // ── Totals ──
  const totalIncome = state.incomeEntries.reduce((s, e) => s + e.amount, 0);
  const totalFixed  = state.fixedCostEntries.reduce((s, e) => s + e.amount, 0);
  const dailyBudget = Math.max(0, (totalIncome - totalFixed - state.savingsTarget) / 30);

  // ── Entry helpers ──
  const updateEntry = (
    key: 'incomeEntries' | 'fixedCostEntries',
    id: string,
    field: 'label' | 'amount',
    value: string | number,
  ) =>
    onChange({
      [key]: (state[key] as BaselineEntry[]).map((e) =>
        e.id === id ? { ...e, [field]: value } : e,
      ),
    });

  const addEntry = (key: 'incomeEntries' | 'fixedCostEntries') =>
    onChange({ [key]: [...(state[key] as BaselineEntry[]), { id: uid(), label: '', amount: 0 }] });

  const removeEntry = (key: 'incomeEntries' | 'fixedCostEntries', id: string) =>
    onChange({ [key]: (state[key] as BaselineEntry[]).filter((e) => e.id !== id) });

  // ── Validation ──
  const validateEntries = (entries: BaselineEntry[]) => {
    const errs: Record<string, string> = {};
    entries.forEach((e) => {
      if (!e.label.trim())  errs[`label_${e.id}`]  = 'Required';
      if (e.amount < 0)     errs[`amount_${e.id}`] = 'Cannot be negative';
    });
    return errs;
  };

  const validateSavings = () => {
    const errs: Record<string, string> = {};
    if (state.savingsTarget < 0)
      errs.savings = 'Amount cannot be negative.';
    else if (state.savingsTarget > totalIncome - totalFixed)
      errs.savings = 'Savings cannot exceed income minus fixed costs.';
    return errs;
  };

  const handleNext = () => {
    let errs: Record<string, string> = {};
    if (subStep === 'income')  errs = validateEntries(state.incomeEntries);
    if (subStep === 'fixed')   errs = validateEntries(state.fixedCostEntries);
    if (subStep === 'savings') errs = validateSavings();

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const nextIdx = SUB_ORDER.indexOf(subStep) + 1;
    if (nextIdx < SUB_ORDER.length) {
      setSubStep(SUB_ORDER[nextIdx]);
    } else {
      onNext();
    }
  };

  const handleBack = () => {
    const prevIdx = SUB_ORDER.indexOf(subStep) - 1;
    if (prevIdx >= 0) {
      setSubStep(SUB_ORDER[prevIdx]);
    } else {
      onBack();
    }
  };

  const meta = LABELS[subStep];
  const isLastSub = subStep === 'savings';

  return (
    <OnboardingCard>
      <LabelTag>{meta.tag}</LabelTag>

      {/* h2 — step heading */}
      <StepHeading>{meta.heading}</StepHeading>
      <StepSubtitle>{meta.sub}</StepSubtitle>

      <InfoNote>
        Your baseline calculates a safe daily spending limit. Update it anytime
        from settings as your finances change.
      </InfoNote>

      {/* ── Income sub-step ──────────────────────────────────────────── */}
      {subStep === 'income' && (
        <>
          <EntryList
            entries={state.incomeEntries}
            errors={errors}
            onUpdate={(id, f, v) => updateEntry('incomeEntries', id, f, v)}
            onAdd={() => addEntry('incomeEntries')}
            onRemove={(id) => removeEntry('incomeEntries', id)}
            addLabel="Add income source"
          />

          <div className="flex items-center justify-between mt-5 pt-4 border-t border-tactical-border">
            <span className="text-[13px] text-muted-text">Total monthly income</span>
            <span className="font-display text-[16px] font-semibold text-muted-emerald">
              {totalIncome.toLocaleString('id-ID')} IDR
            </span>
          </div>
        </>
      )}

      {/* ── Fixed costs sub-step ─────────────────────────────────────── */}
      {subStep === 'fixed' && (
        <>
          <EntryList
            entries={state.fixedCostEntries}
            errors={errors}
            onUpdate={(id, f, v) => updateEntry('fixedCostEntries', id, f, v)}
            onAdd={() => addEntry('fixedCostEntries')}
            onRemove={(id) => removeEntry('fixedCostEntries', id)}
            addLabel="Add expense"
          />

          <div className="flex items-center justify-between mt-5 pt-4 border-t border-tactical-border">
            <span className="text-[13px] text-muted-text">Total fixed costs</span>
            <span className="font-display text-[16px] font-semibold text-dawn-gold">
              {totalFixed.toLocaleString('id-ID')} IDR
            </span>
          </div>
        </>
      )}

      {/* ── Savings sub-step ─────────────────────────────────────────── */}
      {subStep === 'savings' && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="savings-target"
            className="text-[11px] font-medium tracking-[0.06em] uppercase text-muted-text"
          >
            Monthly savings target (IDR)
          </label>
          <Input
            id="savings-target"
            value={state.savingsTarget === 0 ? '' : String(state.savingsTarget)}
            onChange={(e) => {
              onChange({ savingsTarget: Number(sanitizeCurrencyInput(e.target.value)) || 0 });
              setErrors({});
            }}
            placeholder="0"
            suffix="IDR"
            inputMode="numeric"
            error={!!errors.savings}
          />
          {errors.savings && <FieldError message={errors.savings} />}
          <p className="text-[11px] text-muted-text/70 mt-0.5">
            This is your financial priority before any discretionary spend.
          </p>
        </div>
      )}

      {/* Budget preview — always visible */}
      <BudgetCallout
        dailyBudget={dailyBudget}
        currency="Rp"
        sub={`(${totalIncome.toLocaleString('id-ID')} − ${totalFixed.toLocaleString('id-ID')} − ${state.savingsTarget.toLocaleString('id-ID')}) ÷ 30`}
      />

      <ButtonRow
        onBack={handleBack}
        primaryLabel={isLastSub ? 'Review setup' : 'Continue'}
        onPrimary={handleNext}
      />
    </OnboardingCard>
  );
}

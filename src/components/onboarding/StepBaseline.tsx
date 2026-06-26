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
import type { OnboardingState, BaselineEntry, SavingsEntry } from './types';

type SubStep = 'income' | 'fixed' | 'savings';

const SUB_ORDER: SubStep[] = ['income', 'fixed', 'savings'];

// Using a Map instead of a plain object so that LABELS[subStep] bracket notation
// (flagged as CWE-94) is replaced with the safe Map.get() API.
const LABELS = new Map<SubStep, { tag: string; heading: string; sub: string }>([
  ['income',  { tag: 'Baseline 1 of 3', heading: 'How much do you earn?',             sub: 'Enter your total monthly income from all sources.' }],
  ['fixed',   { tag: 'Baseline 2 of 3', heading: 'What are your monthly essentials?', sub: 'List the costs you must pay every month before anything else.' }],
  ['savings', { tag: 'Baseline 3 of 3', heading: 'How much do you want to save?',     sub: 'Set aside money for your future before daily spending begins.' }],
]);

const uid = () => Math.random().toString(36).slice(2, 8);

// ── Entry list editor ────────────────────────────────────────────────────────

interface EntryListProps {
  entries: BaselineEntry[];
  // ── Map instead of plain object ──────────────────────────────────────────────
  // Using Map<string, string> prevents prototype-pollution attacks:
  // a crafted entry.id like "__proto__" or "constructor" would silently
  // write to Object.prototype on a plain object but is completely inert on a Map.
  errors:  Map<string, string>;
  onUpdate: (id: string, field: 'label' | 'amount', value: string | number) => void;
  onAdd:    () => void;
  onRemove: (id: string) => void;
  addLabel: string;
}

function EntryList({ entries, errors, onUpdate, onAdd, onRemove, addLabel }: EntryListProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {entries.map((entry) => {
        const labelErr  = errors.get(`label_${entry.id}`);
        const amountErr = errors.get(`amount_${entry.id}`);
        return (
          <div key={entry.id} className="flex gap-2.5 items-start">
            <div className="flex-1">
              <Input
                value={entry.label}
                onChange={(e) => onUpdate(entry.id, 'label', e.target.value)}
                placeholder="Description"
                error={!!labelErr}
              />
              {labelErr && <FieldError message={labelErr} />}
            </div>

            <div className="w-36">
              <Input
                type="text"
                value={entry.amount === 0 ? '' : entry.amount.toLocaleString('id-ID')}
                onChange={(e) =>
                  onUpdate(entry.id, 'amount', Number(e.target.value.replace(/\D/g, '')) || 0)
                }
                placeholder="0"
                suffix="IDR"
                inputMode="numeric"
                error={!!amountErr}
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
        );
      })}

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

// ── Savings Entry list editor ────────────────────────────────────────────────────────

interface SavingsEntryListProps {
  entries: SavingsEntry[];
  errors:  Map<string, string>;
  onUpdate: (id: string, field: keyof SavingsEntry, value: string | number) => void;
  onAdd:    () => void;
  onRemove: (id: string) => void;
  addLabel: string;
}

function SavingsEntryList({ entries, errors, onUpdate, onAdd, onRemove, addLabel }: SavingsEntryListProps) {
  return (
    <div className="flex flex-col gap-4">
      {entries.map((entry) => {
        const labelErr  = errors.get(`label_${entry.id}`);
        const targetErr = errors.get(`target_${entry.id}`);
        const monthlyErr = errors.get(`monthly_${entry.id}`);
        const deadlineErr = errors.get(`deadline_${entry.id}`);
        return (
          <div key={entry.id} className="flex flex-col gap-2.5 p-3.5 bg-abyssal-slate border border-tactical-border rounded-lg relative">
            <div className="flex justify-between items-center">
              <span className="font-sans text-xs uppercase text-muted-text">Savings Goal</span>
              {entries.length > 0 && (
                <button
                  type="button"
                  onClick={() => onRemove(entry.id)}
                  className="text-muted-text hover:text-terracotta transition-colors"
                  aria-label="Remove entry"
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              )}
            </div>

            <div>
              <Input
                value={entry.label}
                onChange={(e) => onUpdate(entry.id, 'label', e.target.value)}
                placeholder="Goal Name (e.g. Emergency Fund)"
                error={!!labelErr}
              />
              {labelErr && <FieldError message={labelErr} />}
            </div>

            <div className="flex gap-2.5 flex-col md:flex-row mt-1">
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs text-muted-text font-medium">Goal Amount</label>
                <Input
                  type="text"
                  value={entry.target_amount === 0 ? '' : entry.target_amount.toLocaleString('id-ID')}
                  onChange={(e) => onUpdate(entry.id, 'target_amount', Number(e.target.value.replace(/\D/g, '')) || 0)}
                  placeholder="0"
                  suffix="IDR"
                  inputMode="numeric"
                  error={!!targetErr}
                />
                {targetErr && <FieldError message={targetErr} />}
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs text-muted-text font-medium">Monthly Save</label>
                <Input
                  type="text"
                  value={entry.monthly_contribution === 0 ? '' : entry.monthly_contribution.toLocaleString('id-ID')}
                  onChange={(e) => onUpdate(entry.id, 'monthly_contribution', Number(e.target.value.replace(/\D/g, '')) || 0)}
                  placeholder="0"
                  suffix="IDR"
                  inputMode="numeric"
                  error={!!monthlyErr}
                />
                {monthlyErr && <FieldError message={monthlyErr} />}
              </div>
              <div className="w-full md:w-36 flex flex-col gap-1.5">
                <label className="text-xs text-muted-text font-medium" title="Target deadline for your savings goal">Target Deadline</label>
                <Input
                  type="month"
                  value={entry.deadline}
                  onChange={(e) => onUpdate(entry.id, 'deadline', e.target.value)}
                  error={!!deadlineErr}
                />
                <p className="text-[10px] text-muted-text/70 mt-0.5">Target deadline for this goal.</p>
                {deadlineErr && <FieldError message={deadlineErr} />}
              </div>
            </div>
          </div>
        );
      })}

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
  // Map prevents prototype-pollution via crafted entry IDs (CWE-94).
  const [errors,  setErrors]  = React.useState<Map<string, string>>(new Map());

  // Apply jump target if the Review screen triggered an edit
  React.useEffect(() => {
    if (jumpTo) setSubStep(jumpTo);
  }, [jumpTo]);

  // ── Totals ──
  const totalIncome = state.incomeEntries.reduce((s, e) => s + e.amount, 0);
  const totalFixed  = state.fixedCostEntries.reduce((s, e) => s + e.amount, 0);
  const totalSavings = state.savingsEntries.reduce((s, e) => s + e.monthly_contribution, 0);
  const dailyBudget = Math.max(0, (totalIncome - totalFixed - totalSavings) / 30);

  // ── Entry helpers ──
  // Dynamic bracket access (state[key]) is replaced with explicit branches so
  // the property name is never derived from runtime input — eliminating the
  // prototype-pollution vector flagged as CWE-94.
  const updateEntry = (
    key: 'incomeEntries' | 'fixedCostEntries',
    id: string,
    field: 'label' | 'amount',
    value: string | number,
  ) => {
    if (key === 'incomeEntries') {
      onChange({ incomeEntries: state.incomeEntries.map((e) => e.id === id ? { ...e, [field]: value } : e) });
    } else {
      onChange({ fixedCostEntries: state.fixedCostEntries.map((e) => e.id === id ? { ...e, [field]: value } : e) });
    }
  };

  const addEntry = (key: 'incomeEntries' | 'fixedCostEntries') => {
    const newEntry = { id: uid(), label: '', amount: 0 };
    if (key === 'incomeEntries') {
      onChange({ incomeEntries: [...state.incomeEntries, newEntry] });
    } else {
      onChange({ fixedCostEntries: [...state.fixedCostEntries, newEntry] });
    }
  };

  const removeEntry = (key: 'incomeEntries' | 'fixedCostEntries', id: string) => {
    if (key === 'incomeEntries') {
      onChange({ incomeEntries: state.incomeEntries.filter((e) => e.id !== id) });
    } else {
      onChange({ fixedCostEntries: state.fixedCostEntries.filter((e) => e.id !== id) });
    }
  };

  const updateSavingsEntry = (id: string, field: keyof SavingsEntry, value: string | number) => {
    onChange({ savingsEntries: state.savingsEntries.map((e) => e.id === id ? { ...e, [field]: value } : e) });
  };

  const addSavingsEntry = () => {
    const today = new Date();
    today.setFullYear(today.getFullYear() + 1); // default 12-month horizon
    const defaultDeadline = today.toISOString().slice(0, 7); // YYYY-MM
    const newEntry: SavingsEntry = { id: uid(), label: '', target_amount: 0, monthly_contribution: 0, deadline: defaultDeadline };
    onChange({ savingsEntries: [...state.savingsEntries, newEntry] });
  };

  const removeSavingsEntry = (id: string) => {
    onChange({ savingsEntries: state.savingsEntries.filter((e) => e.id !== id) });
  };

  // ── Validation ──
  // Returns a Map so keys derived from entry IDs never touch Object.prototype.
  const validateEntries = (entries: BaselineEntry[]): Map<string, string> => {
    const errs = new Map<string, string>();
    entries.forEach((e) => {
      if (!e.label.trim()) errs.set(`label_${e.id}`,  'Required');
      if (e.amount < 0)    errs.set(`amount_${e.id}`, 'Cannot be negative');
    });
    return errs;
  };

  const validateSavings = (entries: SavingsEntry[]): Map<string, string> => {
    const errs = new Map<string, string>();
    entries.forEach((e) => {
      if (!e.label.trim()) errs.set(`label_${e.id}`, 'Required');
      if (e.target_amount <= 0) errs.set(`target_${e.id}`, 'Must be > 0');
      if (e.monthly_contribution < 0) errs.set(`monthly_${e.id}`, 'Cannot be negative');
      if (!e.deadline) errs.set(`deadline_${e.id}`, 'Required');
    });
    const totalContr = entries.reduce((s, e) => s + e.monthly_contribution, 0);
    if (totalContr > totalIncome - totalFixed) {
      errs.set('global_savings', 'Total savings exceed income minus fixed costs.');
    }
    return errs;
  };

  const handleNext = () => {
    let errs = new Map<string, string>();
    if (subStep === 'income')  errs = validateEntries(state.incomeEntries);
    if (subStep === 'fixed')   errs = validateEntries(state.fixedCostEntries);
    if (subStep === 'savings') errs = validateSavings(state.savingsEntries);

    setErrors(errs);
    if (errs.size > 0) return;

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

  // Map.get() — no bracket notation on user-influenced input (CWE-94 safe).
  // The non-null assertion is safe: subStep is the typed union and all three
  // keys are guaranteed to exist in the Map above.
  const meta = LABELS.get(subStep)!;
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
          <SavingsEntryList
            entries={state.savingsEntries}
            errors={errors}
            onUpdate={updateSavingsEntry}
            onAdd={addSavingsEntry}
            onRemove={removeSavingsEntry}
            addLabel="Add savings target"
          />
          {errors.has('global_savings') && <FieldError message={errors.get('global_savings')!} />}
          <p className="text-[11px] text-muted-text/70 mt-2">
            These monthly contributions are your financial priority before any discretionary spend.
          </p>

          <div className="flex items-center justify-between mt-5 pt-4 border-t border-tactical-border">
            <span className="text-[13px] text-muted-text">Total monthly savings</span>
            <span className="font-display text-[16px] font-semibold text-dawn-gold">
              {totalSavings.toLocaleString('id-ID')} IDR
            </span>
          </div>
        </div>
      )}

      {/* Budget preview — always visible */}
      <BudgetCallout
        dailyBudget={dailyBudget}
        currency="Rp"
        sub={`(${totalIncome.toLocaleString('id-ID')} − ${totalFixed.toLocaleString('id-ID')} − ${totalSavings.toLocaleString('id-ID')}) ÷ 30`}
      />

      <ButtonRow
        onBack={handleBack}
        primaryLabel={isLastSub ? 'Review setup' : 'Continue'}
        onPrimary={handleNext}
      />
    </OnboardingCard>
  );
}

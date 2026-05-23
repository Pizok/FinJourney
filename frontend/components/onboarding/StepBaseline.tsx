'use client';

// components/onboarding/StepBaseline.tsx
// Sub-steps: 3A (Income) → 3B (Fixed Costs) → 3C (Savings Target)

import React from 'react';
import { Plus, Trash2, Info } from 'lucide-react';
import { Button }    from '@/components/ui/button';
import { Input }     from '@/components/ui/input';
import { Label, FieldError, SectionTag, Tooltip } from '@/components/ui/label';
import { sanitizeCurrencyInput } from '@/lib/utils/currency';
import type { OnboardingState, BaselineEntry } from './types';

type SubStep = 'income' | 'fixed' | 'savings';

interface StepBaselineProps {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
  onBack: () => void;
}

// Generates a simple unique id
const uid = () => Math.random().toString(36).slice(2, 8);

// ─── Reusable entry list editor ─────────────────────────────────────────────
function EntryList({
  entries,
  onUpdate,
  onAdd,
  onRemove,
  addLabel,
}: {
  entries: BaselineEntry[];
  onUpdate: (id: string, field: 'label' | 'amount', value: string | number) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  addLabel: string;
}) {
  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="flex gap-3 items-start">
          <div className="flex-1">
            <Input
              value={entry.label}
              onChange={(e) => onUpdate(entry.id, 'label', e.target.value)}
              placeholder="Description"
            />
          </div>
          <div className="w-40">
            <Input
              value={entry.amount === 0 ? '' : String(entry.amount)}
              onChange={(e) =>
                onUpdate(entry.id, 'amount', Number(sanitizeCurrencyInput(e.target.value)) || 0)
              }
              placeholder="0"
              suffix="IDR"
              inputMode="numeric"
            />
          </div>
          {entries.length > 1 && (
            <button
              onClick={() => onRemove(entry.id)}
              className="mt-3 text-muted-text hover:text-coral-danger transition-colors cursor-pointer"
            >
              <Trash2 size={16} strokeWidth={2} />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onAdd}
        className="flex items-center gap-2 text-xs font-sans text-refreshing-teal hover:opacity-80 transition-opacity cursor-pointer mt-1"
      >
        <Plus size={14} strokeWidth={2} />
        {addLabel}
      </button>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function StepBaseline({
  state,
  onChange,
  onNext,
  onBack,
}: StepBaselineProps) {
  const [subStep, setSubStep] = React.useState<SubStep>('income');
  const [errors,  setErrors]  = React.useState<Record<string, string>>({});

  // ── Entry helpers ──
  const updateIncome = (id: string, field: 'label' | 'amount', value: string | number) => {
    onChange({
      incomeEntries: state.incomeEntries.map((e) =>
        e.id === id ? { ...e, [field]: value } : e,
      ),
    });
  };
  const addIncome = () =>
    onChange({ incomeEntries: [...state.incomeEntries, { id: uid(), label: '', amount: 0 }] });
  const removeIncome = (id: string) =>
    onChange({ incomeEntries: state.incomeEntries.filter((e) => e.id !== id) });

  const updateFixed = (id: string, field: 'label' | 'amount', value: string | number) => {
    onChange({
      fixedCostEntries: state.fixedCostEntries.map((e) =>
        e.id === id ? { ...e, [field]: value } : e,
      ),
    });
  };
  const addFixed = () =>
    onChange({ fixedCostEntries: [...state.fixedCostEntries, { id: uid(), label: '', amount: 0 }] });
  const removeFixed = (id: string) =>
    onChange({ fixedCostEntries: state.fixedCostEntries.filter((e) => e.id !== id) });

  // ── Derived totals ──
  const totalIncome = state.incomeEntries.reduce((s, e) => s + e.amount, 0);
  const totalFixed  = state.fixedCostEntries.reduce((s, e) => s + e.amount, 0);

  // ── Navigation validators ──
  const validateIncome = () => {
    const errs: Record<string, string> = {};
    state.incomeEntries.forEach((e) => {
      if (!e.label.trim()) errs[`label_${e.id}`] = 'This field is required.';
      if (e.amount < 0)    errs[`amount_${e.id}`] = 'Amount cannot be negative.';
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateFixed = () => {
    const errs: Record<string, string> = {};
    state.fixedCostEntries.forEach((e) => {
      if (!e.label.trim()) errs[`label_${e.id}`] = 'This field is required.';
      if (e.amount < 0)    errs[`amount_${e.id}`] = 'Amount cannot be negative.';
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateSavings = () => {
    const errs: Record<string, string> = {};
    if (state.savingsTarget < 0) {
      errs.savings = 'Amount cannot be negative.';
    } else if (state.savingsTarget > totalIncome - totalFixed) {
      errs.savings = 'Savings cannot exceed your total income minus fixed costs.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleContinueIncome = () => {
    if (validateIncome()) setSubStep('fixed');
  };
  const handleContinueFixed = () => {
    if (validateFixed()) setSubStep('savings');
  };
  const handleReview = () => {
    if (validateSavings()) onNext();
  };

  // ── Persistent note ──
  const PersistentNote = () => (
    <div className="flex items-start gap-3 bg-slate-canvas border border-clean-border rounded-xl px-4 py-3">
      <Info size={15} className="text-refreshing-teal mt-0.5 shrink-0" strokeWidth={2} />
      <p className="font-sans text-xs text-muted-text leading-relaxed">
        Your baseline helps calculate a safe daily spending limit. You can
        update it anytime from your dashboard as your life changes.
      </p>
    </div>
  );

  // ─── Sub-step: Income ───────────────────────────────────────────────────
  if (subStep === 'income') {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <SectionTag>Baseline 1/3</SectionTag>
          <h1 className="font-display font-semibold text-3xl text-starlight-text tracking-tight mb-2">
            How Much Do You Earn?
          </h1>
          <p className="font-sans text-sm text-muted-text leading-relaxed">
            Enter your total monthly income from all sources.
          </p>
        </div>

        <PersistentNote />

        <div className="space-y-2">
          <Label>Monthly income sources</Label>
          <EntryList
            entries={state.incomeEntries}
            onUpdate={updateIncome}
            onAdd={addIncome}
            onRemove={removeIncome}
            addLabel="Add income source"
          />
          {Object.entries(errors).map(([k, v]) => (
            <FieldError key={k} message={v} />
          ))}
          <Tooltip>
            Use your average monthly income. If it changes, estimate
            conservatively.
          </Tooltip>
        </div>

        {/* Running total */}
        <div className="flex items-center justify-between pt-2 border-t border-clean-border">
          <span className="font-sans text-sm text-muted-text">Total Monthly Income</span>
          <span className="font-display font-semibold text-refreshing-teal text-lg">
            {totalIncome.toLocaleString('id-ID')} IDR
          </span>
        </div>

        <Button size="lg" className="w-full" onClick={handleContinueIncome}>
          Continue
        </Button>
      </div>
    );
  }

  // ─── Sub-step: Fixed Costs ──────────────────────────────────────────────
  if (subStep === 'fixed') {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <SectionTag>Baseline 2/3</SectionTag>
          <h1 className="font-display font-semibold text-3xl text-starlight-text tracking-tight mb-2">
            What Are Your Monthly Essentials?
          </h1>
          <p className="font-sans text-sm text-muted-text leading-relaxed">
            List the costs you must pay every month before spending on anything
            else.
          </p>
        </div>

        <PersistentNote />

        <div className="space-y-2">
          <Label>Essential monthly costs</Label>
          <EntryList
            entries={state.fixedCostEntries}
            onUpdate={updateFixed}
            onAdd={addFixed}
            onRemove={removeFixed}
            addLabel="Add expense"
          />
          {Object.entries(errors).map(([k, v]) => (
            <FieldError key={k} message={v} />
          ))}
          <Tooltip>
            Include rent, bills, subscriptions, and any required payments.
          </Tooltip>
        </div>

        {/* Running total */}
        <div className="flex items-center justify-between pt-2 border-t border-clean-border">
          <span className="font-sans text-sm text-muted-text">Total Fixed Costs</span>
          <span className="font-display font-semibold text-dawn-gold text-lg">
            {totalFixed.toLocaleString('id-ID')} IDR
          </span>
        </div>

        <div className="flex gap-3">
          <Button variant="ghost" size="lg" className="flex-1" onClick={() => setSubStep('income')}>
            Back
          </Button>
          <Button size="lg" className="flex-1" onClick={handleContinueFixed}>
            Continue
          </Button>
        </div>
      </div>
    );
  }

  // ─── Sub-step: Savings ──────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <SectionTag>Baseline 3/3</SectionTag>
        <h1 className="font-display font-semibold text-3xl text-starlight-text tracking-tight mb-2">
          How Much Do You Want to Save?
        </h1>
        <p className="font-sans text-sm text-muted-text leading-relaxed">
          Set aside money for your future before daily spending begins.
        </p>
      </div>

      <PersistentNote />

      <div className="space-y-2">
        <Label htmlFor="savings">Monthly savings target (IDR)</Label>
        <Input
          id="savings"
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
        <FieldError message={errors.savings} />
        <Tooltip>
          This is your financial priority before any expenses.
        </Tooltip>
      </div>

      {/* Budget preview */}
      <div className="bg-slate-canvas border border-clean-border rounded-xl p-4 space-y-2">
        <p className="font-sans text-xs text-muted-text uppercase tracking-widest">
          Daily Budget Preview
        </p>
        <p className="font-display font-semibold text-2xl text-refreshing-teal">
          {Math.max(0, (totalIncome - totalFixed - state.savingsTarget) / 30)
            .toLocaleString('id-ID', { maximumFractionDigits: 0 })} IDR
          <span className="text-sm text-muted-text font-sans font-normal"> / day</span>
        </p>
        <p className="font-sans text-xs text-muted-text">
          (Income − Fixed Costs − Savings) ÷ 30
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" size="lg" className="flex-1" onClick={() => setSubStep('fixed')}>
          Back
        </Button>
        <Button size="lg" className="flex-1" onClick={handleReview}>
          Review Setup
        </Button>
      </div>
    </div>
  );
}

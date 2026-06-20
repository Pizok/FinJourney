'use client';

// =============================================================================
// components/wallet/modals/AddFixedExpenseModal.tsx — FinJourney
//
// Modal for adding a new recurring fixed expense.
//
// Fields:
//   "Expense Name"   — text, required, max 60 chars
//   "Amount"         — Rp currency input, required > 0
//   "Frequency"      — Select: Daily | Weekly | Monthly | Yearly
//   "Target"         — Dynamic field based on Frequency:
//       daily   → hidden (recurrence_value = null)
//       weekly  → Select: Monday–Sunday
//       monthly → Select: 1st–31st + "Last day of month"
//       yearly  → Two selects: Month + Day
//
// Constraint: changing Frequency immediately clears recurrence_value
// to avoid type mismatches (e.g. "15" left over when switching Monthly→Weekly).
//
// CTAs: "Add Expense" | "Cancel"
// =============================================================================

import { useState } from 'react';
import {
  BaseModal,
  FormField,
  FormInput,
  FormSelect,
  ModalFooter,
  PrimaryButton,
  GhostButton,
} from './BaseModal';
import { useWalletStore } from '@/components/wallet/stores/walletStore';
import type { FixedExpense } from '@/types/wallet.types';

// ─── Static option lists ──────────────────────────────────────────────────────

const FREQUENCY_OPTIONS = [
  { value: 'daily',   label: 'Daily' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly',  label: 'Yearly' },
] as const;

const WEEKDAY_OPTIONS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

// 1–31 plus a "Last day" sentinel
const MONTH_DAY_OPTIONS: Array<{ value: string | number; label: string }> = [
  ...Array.from({ length: 31 }, (_, i) => {
    const n = i + 1;
    const suffix = n % 10 === 1 && n !== 11 ? 'st'
      : n % 10 === 2 && n !== 12 ? 'nd'
      : n % 10 === 3 && n !== 13 ? 'rd'
      : 'th';
    return { value: n, label: `${n}${suffix} of the month` };
  }),
  { value: 'last', label: 'Last day of the month' },
];

const MONTH_OPTIONS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

// Days 1–31 for the yearly day picker
const YEAR_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDigits(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '');
  return digits === '' ? 0 : parseInt(digits, 10);
}

function formatAmountDisplay(raw: string): string {
  const n = parseInt(raw || '0', 10);
  return isNaN(n) ? '' : n.toLocaleString('id-ID');
}

// ─── Form state ───────────────────────────────────────────────────────────────

type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface FormValues {
  name: string;
  amount: string;
  recurrence_type: RecurrenceType;
  // For weekly: weekday name string, e.g. "Monday"
  // For monthly: day number string "1"–"31" or "last"
  // For yearly: stored as "MM" + "DD" in two separate fields below
  recurrence_value: string;
  // Only used when recurrence_type === 'yearly'
  yearly_month: string; // "01"–"12"
  yearly_day: string;   // "1"–"31"
}

interface FormErrors {
  name?: string;
  amount?: string;
  recurrence_value?: string;
}

const DEFAULTS: FormValues = {
  name: '',
  amount: '',
  recurrence_type: 'monthly',
  recurrence_value: '1',
  yearly_month: '01',
  yearly_day: '1',
};

function validate(v: FormValues): FormErrors {
  const e: FormErrors = {};

  if (!v.name.trim())
    e.name = 'Expense name is required.';
  else if (v.name.trim().length > 60)
    e.name = 'Name must be 60 characters or fewer.';

  const amount = parseDigits(v.amount);
  if (v.amount.trim() === '' || amount === 0)
    e.amount = 'Amount is required and must be greater than 0.';

  if (v.recurrence_type === 'weekly' && !v.recurrence_value)
    e.recurrence_value = 'Please select a day of the week.';

  return e;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddFixedExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Dynamic "Target" field ───────────────────────────────────────────────────

function RecurrenceValueField({
  type,
  value,
  yearlyMonth,
  yearlyDay,
  error,
  onChange,
  onYearlyChange,
}: {
  type: RecurrenceType;
  value: string;
  yearlyMonth: string;
  yearlyDay: string;
  error?: string;
  onChange: (v: string) => void;
  onYearlyChange: (month: string, day: string) => void;
}) {
  if (type === 'daily') return null;

  if (type === 'weekly') {
    return (
      <FormField label="Day of Week" htmlFor="fe-weekday" error={error} required>
        <FormSelect
          id="fe-weekday"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          hasError={Boolean(error)}
        >
          <option value="" disabled>Select a day…</option>
          {WEEKDAY_OPTIONS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </FormSelect>
      </FormField>
    );
  }

  if (type === 'monthly') {
    return (
      <FormField label="Day of Month" htmlFor="fe-monthday" error={error} required>
        <FormSelect
          id="fe-monthday"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          hasError={Boolean(error)}
        >
          {MONTH_DAY_OPTIONS.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </FormSelect>
      </FormField>
    );
  }

  if (type === 'yearly') {
    return (
      <div className="flex flex-col gap-1.5">
        <span
          className="text-sm font-medium text-[var(--color-pearl-text)]"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          Date of Year <span className="ml-1 text-[var(--color-terracotta)]" aria-hidden="true">*</span>
        </span>
        {/* Month + Day side-by-side inside the Target column */}
        <div className="grid grid-cols-[2fr_1fr] gap-2">
          <FormSelect
            id="fe-year-month"
            aria-label="Month"
            value={yearlyMonth}
            onChange={(e) => onYearlyChange(e.target.value, yearlyDay)}
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </FormSelect>
          <FormSelect
            id="fe-year-day"
            aria-label="Day"
            value={yearlyDay}
            onChange={(e) => onYearlyChange(yearlyMonth, e.target.value)}
          >
            {YEAR_DAY_OPTIONS.map((d) => (
              <option key={d} value={String(d)}>{d}</option>
            ))}
          </FormSelect>
        </div>
        {error && (
          <p role="alert" className="text-xs text-[var(--color-terracotta)]" style={{ fontFamily: 'var(--font-sans)' }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return null;
}

// ─── AddFixedExpenseModal ─────────────────────────────────────────────────────

export function AddFixedExpenseModal({ isOpen, onClose }: AddFixedExpenseModalProps) {
  const { addFixedExpense, loading } = useWalletStore();

  const [values, setValues] = useState<FormValues>(DEFAULTS);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const handleClose = () => {
    setValues(DEFAULTS);
    setErrors({});
    setSubmitted(false);
    onClose();
  };

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    const next = { ...values, [key]: value };
    setValues(next);
    if (submitted) setErrors(validate(next));
  }

  // ── Frequency change: also clears recurrence_value to avoid mismatch ────────
  function handleFrequencyChange(type: RecurrenceType) {
    const defaultValue: Record<RecurrenceType, string> = {
      daily:   '',
      weekly:  '',
      monthly: '1',
      yearly:  '',
    };
    const next: FormValues = {
      ...values,
      recurrence_type: type,
      recurrence_value: defaultValue[type],
      yearly_month: '01',
      yearly_day: '1',
    };
    setValues(next);
    if (submitted) setErrors(validate(next));
  }

  // ── Resolve final recurrence_value for the FixedExpense object ──────────────
  function resolveRecurrenceValue(): string | number | null {
    switch (values.recurrence_type) {
      case 'daily':
        return null;
      case 'weekly':
        return values.recurrence_value || null;
      case 'monthly': {
        if (values.recurrence_value === 'last') return 'last';
        const n = parseInt(values.recurrence_value, 10);
        return isNaN(n) ? null : n;
      }
      case 'yearly':
        return `${values.yearly_month}-${String(values.yearly_day).padStart(2, '0')}`;
      default:
        return null;
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    setSubmitted(true);
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const newExpense: FixedExpense = {
      id: `fe-${Date.now()}`,
      name: values.name.trim(),
      amount: parseDigits(values.amount),
      recurrence_type: values.recurrence_type,
      recurrence_value: resolveRecurrenceValue(),
    };

    addFixedExpense(newExpense);
    handleClose();

    // ── TODO: Uncomment real mutation when API is live ──────────────────────
    // try {
    //   const res = await fetch('/api/v1/fixed-expenses', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //       name: newExpense.name,
    //       amount: newExpense.amount,
    //       recurrence_type: newExpense.recurrence_type,
    //       recurrence_value: newExpense.recurrence_value,
    //     }),
    //   });
    //   const json = await res.json();
    //   if (!json.success) {
    //     removeFixedExpense(newExpense.id);
    //     setGlobalError(json.error?.message ?? 'Failed to add expense.');
    //   }
    // } catch {
    //   removeFixedExpense(newExpense.id);
    //   setGlobalError('Network error — expense could not be saved.');
    // }
  };

  const isMutating = loading.baselines;
  const showTargetField = values.recurrence_type !== 'daily';

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Fixed Expense"
      maxWidth="lg"
    >
      <div className="flex flex-col gap-5">

        {/* Expense Name */}
        <FormField label="Expense Name" htmlFor="fe-name" error={errors.name} required>
          <FormInput
            id="fe-name"
            type="text"
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="e.g. Sewa Kost, Internet, Gym"
            hasError={Boolean(errors.name)}
            maxLength={60}
            autoComplete="off"
          />
        </FormField>

        {/* Amount */}
        <FormField
          label="Amount"
          htmlFor="fe-amount"
          error={errors.amount}
          hint="Fixed amount paid each recurrence cycle."
          required
        >
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted-text)]"
              aria-hidden="true"
            >
              Rp
            </span>
            <FormInput
              id="fe-amount"
              type="text"
              inputMode="numeric"
              value={formatAmountDisplay(values.amount)}
              onChange={(e) => setField('amount', e.target.value.replace(/[^\d]/g, ''))}
              placeholder="0"
              hasError={Boolean(errors.amount)}
              className="pl-9 tabular-nums"
            />
          </div>
        </FormField>

        {/*
         * Frequency + Target — 2-column grid.
         * When daily is selected, the Target column disappears and
         * Frequency expands to fill the full width naturally.
         */}
        <div className={`grid gap-4 ${showTargetField ? 'grid-cols-2' : 'grid-cols-1'}`}>

          {/* Column 1: Frequency */}
          <FormField label="Frequency" htmlFor="fe-frequency" required>
            <FormSelect
              id="fe-frequency"
              value={values.recurrence_type}
              onChange={(e) => handleFrequencyChange(e.target.value as RecurrenceType)}
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </FormSelect>
          </FormField>

          {/* Column 2: Dynamic Target — hidden for daily */}
          {showTargetField && (
            <RecurrenceValueField
              type={values.recurrence_type}
              value={values.recurrence_value}
              yearlyMonth={values.yearly_month}
              yearlyDay={values.yearly_day}
              error={errors.recurrence_value}
              onChange={(v) => setField('recurrence_value', v)}
              onYearlyChange={(month, day) => {
                const next = { ...values, yearly_month: month, yearly_day: day };
                setValues(next);
                if (submitted) setErrors(validate(next));
              }}
            />
          )}

        </div>

      </div>

      <ModalFooter>
        <GhostButton onClick={handleClose} disabled={isMutating}>
          Cancel
        </GhostButton>
        <PrimaryButton
          onClick={handleSubmit}
          disabled={isMutating}
          aria-busy={isMutating}
        >
          {isMutating ? 'Adding…' : 'Add Expense'}
        </PrimaryButton>
      </ModalFooter>
    </BaseModal>
  );
}

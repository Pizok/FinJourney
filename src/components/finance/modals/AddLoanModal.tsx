'use client';

// =============================================================================
// components/wallet/modals/AddLoanModal.tsx — FinJourney
//
// Modal for tracking a new active loan/debt.
//
// Fields:
//   "Loan Name"             (required, max 60 chars)
//   "Total Loan Amount"     (required, > 0, Rp prefix)
//   "Amount Already Paid"   (required >= 0, must be <= Total, Rp prefix)
//   "Monthly Installment"   (required, > 0, Rp prefix)
//   "Next Due Date"         (required, date picker, must not be in the past)
//
// CTAs: "Add Loan" | "Cancel"
//
// Progress bar preview inside the modal shows paid/total before submitting.
// Remaining balance shown in terracotta to match the ActiveLoans display.
//
// Optimistic: calls addLoan() immediately, closes modal.
// Real API mutation is drafted and commented out.
// =============================================================================

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BaseModal,
  FormField,
  FormInput,
  ModalFooter,
  PrimaryButton,
  GhostButton,
} from '@/components/shared/modals/BaseModal';
import { useWalletStore } from '@/components/finance/stores/walletStore';
import { Progress } from '@/components/ui/Progress';
import type { Loan } from '@/types/wallet.types';
import { apiFetchClient } from '@/lib/apiClient.client';
import { toast } from 'sonner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDigits(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '');
  return digits === '' ? 0 : parseInt(digits, 10);
}

function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

function formatAmountDisplay(raw: string): string {
  const n = parseInt(raw || '0', 10);
  return isNaN(n) ? '' : n.toLocaleString('id-ID');
}

// Minimum ISO date string for today in local timezone (for date input min)
function todayISO(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormValues {
  name: string;
  total_amount: string;
  paid_amount: string;
  monthly_installment: string;
  next_due_date: string;
}

interface FormErrors {
  name?: string;
  total_amount?: string;
  paid_amount?: string;
  monthly_installment?: string;
  next_due_date?: string;
}

const DEFAULTS: FormValues = {
  name: '',
  total_amount: '',
  paid_amount: '0',
  monthly_installment: '',
  next_due_date: '',
};

function validate(v: FormValues): FormErrors {
  const e: FormErrors = {};

  if (!v.name.trim())
    e.name = 'Loan name is required.';
  else if (v.name.trim().length > 60)
    e.name = 'Name must be 60 characters or fewer.';

  const total = parseDigits(v.total_amount);
  if (v.total_amount.trim() === '' || total === 0)
    e.total_amount = 'Total loan amount is required and must be greater than 0.';

  const paid = parseDigits(v.paid_amount);
  if (paid < 0)
    e.paid_amount = 'Paid amount cannot be negative.';
  else if (total > 0 && paid > total)
    e.paid_amount = 'Amount paid cannot exceed the total loan amount.';

  const installment = parseDigits(v.monthly_installment);
  if (v.monthly_installment.trim() === '' || installment === 0)
    e.monthly_installment = 'Monthly installment is required and must be greater than 0.';

  if (!v.next_due_date)
    e.next_due_date = 'Next due date is required.';

  return e;
}

// ─── Currency input sub-component ─────────────────────────────────────────────

function RpInput({
  id,
  value,
  onChange,
  hasError,
  placeholder = '0',
}: {
  id: string;
  value: string;
  onChange: (raw: string) => void;
  hasError?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted-text)]"
        aria-hidden="true"
      >
        Rp
      </span>
      <FormInput
        id={id}
        type="text"
        inputMode="numeric"
        value={formatAmountDisplay(value)}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
        placeholder={placeholder}
        hasError={hasError}
        className="pl-9 tabular-nums"
      />
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Loan | null;
}

// ─── AddLoanModal ─────────────────────────────────────────────────────────────

export function AddLoanModal({ isOpen, onClose, initialData }: AddLoanModalProps) {
  const { setGlobalError } = useWalletStore();

  const [values, setValues] = useState<FormValues>(DEFAULTS);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Only use YYYY-MM-DD from ISO string
        const initialDate = initialData.next_due_date ? initialData.next_due_date.split('T')[0] : '';
        setValues({
          name: initialData.name,
          total_amount: initialData.total_amount.toString(),
          paid_amount: initialData.paid_amount.toString(),
          monthly_installment: initialData.monthly_installment.toString(),
          next_due_date: initialDate,
        });
      } else {
        setValues(DEFAULTS);
      }
      setErrors({});
      setSubmitted(false);
    }
  }, [isOpen, initialData]);

  const handleClose = () => {
    setValues(DEFAULTS);
    setErrors({});
    setSubmitted(false);
    onClose();
  };

  function setField(key: keyof FormValues, value: string) {
    const next = { ...values, [key]: value };
    setValues(next);
    if (submitted) setErrors(validate(next));
  }

  // ── Live preview calculations ──────────────────────────────────────────────
  const totalNum = parseDigits(values.total_amount);
  const paidNum = parseDigits(values.paid_amount);
  const remaining = Math.max(0, totalNum - paidNum);
  const progressPct = totalNum > 0
    ? Math.min(100, Math.round((paidNum / totalNum) * 100))
    : 0;
  const showPreview = totalNum > 0;

  const queryClient = useQueryClient();

  const addLoanMutation = useMutation({
    mutationFn: async (payload: any) => {
      const endpoint = initialData ? `loans/${initialData.id}` : 'loans';
      const method = initialData ? 'PATCH' : 'POST';
      return apiFetchClient(endpoint, {
        method,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'bootstrap'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      toast.success(initialData ? 'Loan updated.' : 'Loan added.');
      handleClose();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to add loan');
    }
  });

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitted(true);
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const payload = {
      name: values.name.trim(),
      total_amount: parseDigits(values.total_amount),
      paid_amount: parseDigits(values.paid_amount),
      next_due_date: values.next_due_date,
      monthly_installment: parseDigits(values.monthly_installment),
    };

    addLoanMutation.mutate(payload);
  };

  const isMutating = addLoanMutation.isPending;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title={initialData ? "Edit Loan" : "Add Loan"}
      maxWidth="lg"
    >
      <div className="flex flex-col gap-5">

        {/* Loan Name */}
        <FormField
          label="Loan Name"
          htmlFor="loan-name"
          error={errors.name}
          required
        >
          <FormInput
            id="loan-name"
            type="text"
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="e.g. KPR BRI, Cicilan Motor, KTA"
            hasError={Boolean(errors.name)}
            maxLength={60}
            autoComplete="off"
          />
        </FormField>

        {/* Total Loan Amount + Amount Already Paid — two columns */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            label="Total Loan Amount"
            htmlFor="loan-total"
            error={errors.total_amount}
            required
          >
            <RpInput
              id="loan-total"
              value={values.total_amount}
              onChange={(v) => setField('total_amount', v)}
              hasError={Boolean(errors.total_amount)}
            />
          </FormField>

          <FormField
            label="Amount Already Paid"
            htmlFor="loan-paid"
            error={errors.paid_amount}
            hint="How much you've repaid so far."
            required
          >
            <RpInput
              id="loan-paid"
              value={values.paid_amount}
              onChange={(v) => setField('paid_amount', v)}
              hasError={Boolean(errors.paid_amount)}
            />
          </FormField>
        </div>

        {/* Live progress preview — only shown when total > 0 */}
        {showPreview && (
          <div className="rounded-lg border border-[var(--color-tactical-border)] bg-[var(--color-abyssal-slate)] px-4 py-3.5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span
                className="text-xs text-[var(--color-muted-text)]"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                {formatRupiah(paidNum)} paid · {progressPct}%
              </span>
              <span
                className="text-xs font-medium text-[var(--color-terracotta)]"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                {formatRupiah(remaining)} remaining
              </span>
            </div>
            <Progress
              value={paidNum}
              max={totalNum}
              colorVar="--color-muted-emerald"
              height="sm"
              aria-label={`${progressPct}% of loan repaid`}
            />
          </div>
        )}

        {/* Monthly Installment + Next Due Date — two columns */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            label="Monthly Installment"
            htmlFor="loan-installment"
            error={errors.monthly_installment}
            hint="Fixed payment amount each month."
            required
          >
            <RpInput
              id="loan-installment"
              value={values.monthly_installment}
              onChange={(v) => setField('monthly_installment', v)}
              hasError={Boolean(errors.monthly_installment)}
            />
          </FormField>

          <FormField
            label="Next Due Date"
            htmlFor="loan-due-date"
            error={errors.next_due_date}
            required
          >
            <FormInput
              id="loan-due-date"
              type="date"
              value={values.next_due_date}
              onChange={(e) => setField('next_due_date', e.target.value)}
              hasError={Boolean(errors.next_due_date)}
              min={todayISO()}
              className="[color-scheme:dark]"
            />
          </FormField>
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
          {isMutating ? (initialData ? 'Updating…' : 'Adding…') : (initialData ? 'Update Loan' : 'Add Loan')}
        </PrimaryButton>
      </ModalFooter>
    </BaseModal>
  );
}


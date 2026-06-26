'use client';

// =============================================================================
// components/finance/modals/AddSavingsTargetModal.tsx — FinJourney
//
// Modal for adding a new savings target.
// =============================================================================

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BaseModal,
  FormField,
  FormInput,
  FormCurrencyInput,
  ModalFooter,
  PrimaryButton,
  GhostButton,
} from './BaseModal';
import { toast } from 'sonner';
import type { SavingsTarget } from '../baselines/FinancialSummaryCard';

interface FormValues {
  name: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number;
  deadline: string;
}

interface FormErrors {
  name?: string;
  target_amount?: string;
  current_amount?: string;
  monthly_contribution?: string;
  deadline?: string;
}

const DEFAULTS: FormValues = {
  name: '',
  target_amount: 0,
  current_amount: 0,
  monthly_contribution: 0,
  deadline: '',
};

function validate(v: FormValues): FormErrors {
  const e: FormErrors = {};
  if (!v.name.trim()) {
    e.name = 'Target name is required.';
  } else if (v.name.trim().length > 100) {
    e.name = 'Name must be 100 characters or fewer.';
  }
  
  if (v.target_amount <= 0) {
    e.target_amount = 'Target amount must be greater than 0.';
  }
  
  if (v.current_amount < 0) {
    e.current_amount = 'Current amount cannot be negative.';
  } else if (v.target_amount > 0 && v.current_amount > v.target_amount) {
    e.current_amount = 'Current amount cannot exceed target amount.';
  }

  if (v.monthly_contribution < 0) {
    e.monthly_contribution = 'Monthly contribution cannot be negative.';
  }

  if (!v.deadline) {
    e.deadline = 'Deadline is required.';
  } else {
    const d = new Date(v.deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(d.getTime())) {
      e.deadline = 'Invalid date.';
    } else if (d <= today) {
      e.deadline = 'Deadline must be a future date.';
    }
  }

  return e;
}

interface AddSavingsTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: SavingsTarget | null;
}

export function AddSavingsTargetModal({ isOpen, onClose, initialData }: AddSavingsTargetModalProps) {
  const [values, setValues] = useState<FormValues>(DEFAULTS);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Strip timezone and only use YYYY-MM-DD
        const initialDate = initialData.deadline ? initialData.deadline.split('T')[0] : '';
        setValues({
          name: initialData.name,
          target_amount: initialData.target_amount,
          current_amount: initialData.current_amount,
          monthly_contribution: initialData.monthly_contribution,
          deadline: initialDate,
        });
      } else {
        setValues(DEFAULTS);
      }
      setErrors({});
      setSubmitted(false);
    }
  }, [isOpen, initialData]);

  const queryClient = useQueryClient();

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

  const addMutation = useMutation({
    mutationFn: async (payload: FormValues) => {
      const url = initialData ? `/api/v1/savings-targets/${initialData.id}` : '/api/v1/savings-targets';
      const method = initialData ? 'PATCH' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let msg = initialData ? 'Failed to update savings target' : 'Failed to add savings target';
        try {
          const errData = await response.json();
          msg = errData.detail || msg;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings_targets'] });
      toast.success(initialData ? 'Savings target updated' : 'Savings target added');
      handleClose();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    }
  });

  const handleSubmit = () => {
    setSubmitted(true);
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    addMutation.mutate({
      name: values.name.trim(),
      target_amount: values.target_amount,
      current_amount: values.current_amount,
      monthly_contribution: values.monthly_contribution,
      deadline: values.deadline,
    });
  };

  const isMutating = addMutation.isPending;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title={initialData ? "Edit Savings Target" : "Add Savings Target"}
      maxWidth="md"
    >
      <div className="flex flex-col gap-5">
        <FormField label="Target Name" htmlFor="st-name" error={errors.name} required>
          <FormInput
            id="st-name"
            type="text"
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="e.g. Emergency Fund, Laptop"
            hasError={Boolean(errors.name)}
            maxLength={100}
            autoComplete="off"
          />
        </FormField>

        <FormField
          label="Goal Amount"
          htmlFor="st-target"
          error={errors.target_amount}
          required
        >
          <FormCurrencyInput
            id="st-target"
            value={values.target_amount}
            onChange={(e) => setField('target_amount', Number(e.target.value))}
            hasError={Boolean(errors.target_amount)}
            placeholder="0"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Already Saved"
            htmlFor="st-current"
            error={errors.current_amount}
            hint="Amount you've already put aside."
          >
            <FormCurrencyInput
              id="st-current"
              value={values.current_amount}
              onChange={(e) => setField('current_amount', Number(e.target.value))}
              hasError={Boolean(errors.current_amount)}
              placeholder="0"
            />
          </FormField>

          <FormField
            label="Monthly Contribution"
            htmlFor="st-monthly"
            error={errors.monthly_contribution}
            hint="Planned monthly deposit."
          >
            <FormCurrencyInput
              id="st-monthly"
              value={values.monthly_contribution}
              onChange={(e) => setField('monthly_contribution', Number(e.target.value))}
              hasError={Boolean(errors.monthly_contribution)}
              placeholder="0"
            />
          </FormField>
        </div>

        <FormField
          label="Deadline"
          htmlFor="st-deadline"
          error={errors.deadline}
          required
        >
          <FormInput
            id="st-deadline"
            type="date"
            value={values.deadline}
            onChange={(e) => setField('deadline', e.target.value)}
            hasError={Boolean(errors.deadline)}
          />
        </FormField>
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
          {isMutating ? (initialData ? 'Updating…' : 'Adding…') : (initialData ? 'Update Target' : 'Add Target')}
        </PrimaryButton>
      </ModalFooter>
    </BaseModal>
  );
}

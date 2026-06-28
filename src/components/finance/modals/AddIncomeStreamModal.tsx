'use client';

// =============================================================================
// components/finance/modals/AddIncomeStreamModal.tsx — FinJourney
//
// Modal for adding a new income stream.
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
} from '@/components/shared/modals/BaseModal';
import { toast } from 'sonner';
import type { IncomeStream } from '../baselines/FinancialSummaryCard';
import { apiFetchClient } from '@/lib/apiClient.client';

interface FormValues {
  name: string;
  amount: number;
}

interface FormErrors {
  name?: string;
  amount?: string;
}

const DEFAULTS: FormValues = {
  name: '',
  amount: 0,
};

function validate(v: FormValues): FormErrors {
  const e: FormErrors = {};
  if (!v.name.trim()) {
    e.name = 'Income stream name is required.';
  } else if (v.name.trim().length > 60) {
    e.name = 'Name must be 60 characters or fewer.';
  }
  if (v.amount <= 0) {
    e.amount = 'Amount must be greater than 0.';
  }
  return e;
}

interface AddIncomeStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: IncomeStream | null;
}

export function AddIncomeStreamModal({ isOpen, onClose, initialData }: AddIncomeStreamModalProps) {
  const [values, setValues] = useState<FormValues>(DEFAULTS);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setValues({
          name: initialData.name,
          amount: initialData.amount,
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
      const endpoint = initialData ? `income-streams/${initialData.id}` : 'income-streams';
      const method = initialData ? 'PATCH' : 'POST';
      return apiFetchClient(endpoint, {
        method,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income_streams'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      toast.success(initialData ? 'Income stream updated' : 'Income stream added');
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
      amount: values.amount,
    });
  };

  const isMutating = addMutation.isPending;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title={initialData ? "Edit Income Stream" : "Add Income Stream"}
      maxWidth="md"
    >
      <div className="flex flex-col gap-5">
        <FormField label="Income Name" htmlFor="is-name" error={errors.name} required>
          <FormInput
            id="is-name"
            type="text"
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="e.g. Primary Salary, Freelance"
            hasError={Boolean(errors.name)}
            maxLength={60}
            autoComplete="off"
          />
        </FormField>

        <FormField
          label="Amount"
          htmlFor="is-amount"
          error={errors.amount}
          hint="Monthly income amount."
          required
        >
          <FormCurrencyInput
            id="is-amount"
            value={values.amount}
            onChange={(e) => setField('amount', Number(e.target.value))}
            hasError={Boolean(errors.amount)}
            placeholder="0"
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
          {isMutating ? (initialData ? 'Updating…' : 'Adding…') : (initialData ? 'Update Income' : 'Add Income')}
        </PrimaryButton>
      </ModalFooter>
    </BaseModal>
  );
}

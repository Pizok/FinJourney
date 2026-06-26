'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetchClient } from '@/lib/apiClient.client';
import { useDashboardData } from './useDashboardData';
import { useDashboardModals } from './useDashboardModals';
import { parseAmount } from '../utils/dashboard.helpers';
import type {
  AddTransactionPayload,
  AddTransactionErrors,
  TransactionType,
  Wallet,
  Category,
} from '../types/dashboard.types';

interface UseTransactionModalReturn {
  form: AddTransactionPayload;
  errors: AddTransactionErrors;
  isSubmitting: boolean;
  wallets: Wallet[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  setType: (type: TransactionType) => void;
  setField: (field: keyof AddTransactionPayload, value: string) => void;
  submit: () => Promise<void>;
  reset: () => void;
}

const EMPTY_FORM: AddTransactionPayload = {
  type: 'expense',
  amount: '',
  wallet_id: '',
  category_id: '',
  note: '',
};

/**
 * Manages form state, field updates, validation, and submission
 * for the AddTransactionModal.
 *
 * Submission is a stub that logs the payload to the console.
 * Replace the body of `submit()` with a real POST /transactions call.
 */
export function useTransactionModal(): UseTransactionModalReturn {
  const { data } = useDashboardData();
  const { closeModal } = useDashboardModals();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<AddTransactionPayload>(EMPTY_FORM);
  const [errors, setErrors] = useState<AddTransactionErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const expenseCategories = data.categories.filter(
    (c) => c.category_group === 'expense'
  );
  const incomeCategories = data.categories.filter(
    (c) => c.category_group === 'income'
  );

  function setType(type: TransactionType) {
    setForm((prev) => ({ ...prev, type, category_id: '' }));
    setErrors({});
  }

  function setField(field: keyof AddTransactionPayload, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof AddTransactionErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function validate(): AddTransactionErrors {
    const next: AddTransactionErrors = {};
    const parsed = parseAmount(form.amount);

    if (!form.amount || isNaN(parsed) || parsed <= 0) {
      next.amount = 'Enter a valid amount greater than zero.';
    }
    if (!form.wallet_id) {
      next.wallet_id = 'Select a wallet.';
    }
    if (form.type !== 'transfer' && !form.category_id) {
      next.category_id = 'Select a category.';
    }
    return next;
  }

  async function submit() {
    const validation = validate();
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetchClient('transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseAmount(form.amount) }),
      });
      
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'bootstrap'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      
      reset();
      closeModal();
    } catch (err: any) {
      setErrors({ general: err?.message || 'Something went wrong. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  function reset() {
    setForm(EMPTY_FORM);
    setErrors({});
  }

  return {
    form,
    errors,
    isSubmitting,
    wallets: data.wallets,
    expenseCategories,
    incomeCategories,
    setType,
    setField,
    submit,
    reset,
  };
}

'use client';

// =============================================================================
// components/wallet/modals/CategoryModal.tsx — FinJourney
//
// Modal for creating a new custom category or editing an existing one.
// Uses React Hook Form with Zod validation.
//
// Fields:
//   "Category Name" | "Monthly Limit"
//
// Validation:
//   - Category Name: required, max 50 chars.
//   - Monthly Limit: required, must be >= 0. Displays "Uncapped" if 0.
// =============================================================================

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BaseModal, FormField, FormInput, FormCurrencyInput,
  ModalFooter, PrimaryButton, GhostButton,
} from '@/components/shared/modals/BaseModal';
import { useWalletStore, selectEditCategory } from '@/components/finance/stores/walletStore';
import { apiFetchClient } from '@/lib/apiClient.client';

// ---------------------------------------------------------------------------
// Validation Schema
// ---------------------------------------------------------------------------

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required.').max(50, 'Must be 50 characters or fewer.'),
  monthly_limit: z.coerce.number().min(0, 'Limit cannot be negative.'),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

// ---------------------------------------------------------------------------
// CategoryModal
// ---------------------------------------------------------------------------

export function CategoryModal() {
  const {
    ui: { isCategoryModalOpen },
    closeCategoryModal,
    addCategory,
    updateCategory,
    setGlobalError,
    featureUnlocks,
    categories,
  } = useWalletStore();

  const editCategory = useWalletStore(selectEditCategory);
  const isEditing = !!editCategory;
  
  // Hard cap logic
  const isAtLimit = !isEditing && (categories.length >= featureUnlocks.max_categories && !featureUnlocks.can_create_category);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema) as any,
    defaultValues: {
      name: '',
      monthly_limit: 0,
    },
  });

  const watchLimit = watch('monthly_limit');

  // Sync form when editing changes
  useEffect(() => {
    if (isCategoryModalOpen) {
      if (editCategory) {
        reset({
          name: editCategory.name,
          monthly_limit: editCategory.monthly_limit || 0,
        });
      } else {
        reset({
          name: '',
          monthly_limit: 0,
        });
      }
    }
  }, [isCategoryModalOpen, editCategory, reset]);

  const queryClient = useQueryClient();

  const createCategoryMutation = useMutation({
    mutationFn: async (payload: CategoryFormValues) => {
      return await apiFetchClient('categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      // The API returns { success: true, data: CategoryOut }
      if (data) {
        addCategory(data as any);
      }
      queryClient.invalidateQueries({ queryKey: ['wallet', 'bootstrap'] });
      handleClose();
    },
    onError: (err: any) => {
      setGlobalError(err.message);
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async (payload: CategoryFormValues) => {
      if (!editCategory) throw new Error("No active category to edit");
      return await apiFetchClient(`categories/${editCategory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      if (editCategory) {
        updateCategory(editCategory.id, data as any || {});
      }
      queryClient.invalidateQueries({ queryKey: ['wallet', 'bootstrap'] });
      handleClose();
    },
    onError: (err: any) => {
      setGlobalError(err.message);
    }
  });

  const handleClose = () => {
    reset();
    closeCategoryModal();
  };

  const onSubmit = (data: CategoryFormValues) => {
    if (isEditing) {
      updateCategoryMutation.mutate(data);
    } else {
      createCategoryMutation.mutate(data);
    }
  };

  const isMutating = createCategoryMutation.isPending || updateCategoryMutation.isPending;

  return (
    <BaseModal
      isOpen={isCategoryModalOpen}
      onClose={handleClose}
      title={isEditing ? 'Edit Category' : 'Create Custom Category'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* Capacity warning */}
        {isAtLimit && (
          <div className="rounded-lg border border-[var(--color-dawn-gold)]/30 bg-[var(--color-dawn-gold)]/5 px-4 py-3">
            <p className="text-xs text-[var(--color-dawn-gold)]" style={{ fontFamily: 'var(--font-sans)' }}>
              You've reached the category limit for your current level. Unlock more at Level 3.
            </p>
          </div>
        )}

        {/* Category Name */}
        <FormField label="Category Name" htmlFor="category-name" error={errors.name?.message} required>
          <FormInput
            id="category-name"
            type="text"
            placeholder="e.g. Dining Out, Coffee, Subscriptions"
            hasError={Boolean(errors.name)}
            maxLength={50}
            autoComplete="off"
            disabled={isAtLimit || isMutating}
            {...register('name')}
          />
        </FormField>

        {/* Monthly Limit */}
        <FormField
          label="Monthly Limit"
          htmlFor="category-limit"
          error={errors.monthly_limit?.message}
          hint={Number(watchLimit) === 0 ? "0 = Uncapped (no spending limit)" : "Enter the maximum amount you plan to spend per month."}
          required
        >
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted-text)]"
              aria-hidden="true"
            >
              Rp
            </span>
            <FormCurrencyInput
              id="category-limit"
              value={watchLimit ? watchLimit.toString() : ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value.replace(/\D/g, '')) || 0;
                setValue('monthly_limit', val, { shouldValidate: true });
              }}
              placeholder="0"
              hasError={Boolean(errors.monthly_limit)}
              className="pl-9"
              disabled={isAtLimit || isMutating}
            />
          </div>
        </FormField>

        {/* Footer */}
        <ModalFooter>
          <GhostButton type="button" onClick={handleClose} disabled={isMutating}>
            Cancel
          </GhostButton>
          <PrimaryButton
            type="submit"
            disabled={isMutating || isAtLimit}
            aria-busy={isMutating}
          >
            {isMutating ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Category'}
          </PrimaryButton>
        </ModalFooter>
      </form>
    </BaseModal>
  );
}

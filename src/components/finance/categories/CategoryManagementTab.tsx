'use client';

// =============================================================================
// components/wallet/categories/CategoryManagementTab.tsx — FinJourney
//
// The Category Management tab inside the Finance layout.
// Lists all custom categories with edit and delete actions.
// Uses optimistic UI for deletions (with rollback on error).
// =============================================================================

import { useWalletStore } from '@/components/finance/stores/walletStore';
import { Pencil, Trash2, Plus, AlertCircle, LayoutGrid } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetchClient } from '@/lib/apiClient.client';
import { Category } from '@/types/wallet.types';
import { useState } from 'react';

export function CategoryManagementTab() {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const {
    categories,
    openAddCategory,
    openEditCategory,
    removeCategory,
    restoreCategory,
    setGlobalError,
    featureUnlocks,
  } = useWalletStore();

  const queryClient = useQueryClient();

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      return await apiFetchClient(`categories/${categoryId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      // Background validation, optimistic UI is already applied
      queryClient.invalidateQueries({ queryKey: ['wallet', 'bootstrap'] });
    },
    onError: (err: any, categoryId: string, context: any) => {
      // Rollback on error
      if (context?.previousCategory) {
        restoreCategory(context.previousCategory);
      }
      setGlobalError(err.message || 'Failed to delete category');
    }
  });

  const confirmDelete = (category: Category) => {
    setConfirmDeleteId(null);
    // 1. Optimistically remove from store
    removeCategory(category.id);
    
    // 2. Perform background delete mutation, pass context for rollback
    deleteCategoryMutation.mutate(category.id, {
      context: { previousCategory: category }
    } as any);
  };

  const isAtLimit = categories.length >= featureUnlocks.max_categories && !featureUnlocks.can_create_category;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-pearl-text)]" style={{ fontFamily: 'var(--font-display)' }}>
            Category Management
          </h2>
          <p className="text-sm text-[var(--color-muted-text)]" style={{ fontFamily: 'var(--font-sans)' }}>
            Manage your custom spending categories and monthly limits.
          </p>
        </div>
        
        <button
          onClick={openAddCategory}
          disabled={isAtLimit}
          className={[
            'flex items-center justify-center gap-2 rounded-lg bg-[var(--color-muted-emerald)] px-4 py-2',
            'text-sm font-semibold text-[var(--color-pearl-text)] transition-colors',
            'hover:bg-[var(--color-muted-emerald)]/90 focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-[var(--color-muted-emerald)] focus-visible:ring-offset-2',
            'focus-visible:ring-offset-[var(--color-canvas-surface)]',
            'disabled:cursor-not-allowed disabled:opacity-50'
          ].join(' ')}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <Plus className="h-4 w-4" />
          <span>New Category</span>
        </button>
      </div>

      {/* Limit Warning */}
      {isAtLimit && (
        <div className="flex items-start gap-3 rounded-lg border border-[var(--color-dawn-gold)]/30 bg-[var(--color-dawn-gold)]/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-dawn-gold)]" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-dawn-gold)]" style={{ fontFamily: 'var(--font-sans)' }}>
              Category Limit Reached
            </h3>
            <p className="mt-1 text-sm text-[var(--color-dawn-gold)]/80" style={{ fontFamily: 'var(--font-sans)' }}>
              You've reached the maximum number of categories ({featureUnlocks.max_categories}) for your current level. Level up to unlock more!
            </p>
          </div>
        </div>
      )}

      {/* Category List */}
      <div className="rounded-xl border border-[var(--color-tactical-border)] bg-[var(--color-abyssal-slate)]/40 overflow-hidden">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-abyssal-slate)] mb-4 border border-[var(--color-tactical-border)]">
              <LayoutGrid className="h-6 w-6 text-[var(--color-muted-text)]" strokeWidth={1.5} />
            </div>
            <h3 className="text-sm font-medium text-[var(--color-pearl-text)]" style={{ fontFamily: 'var(--font-sans)' }}>
              No custom categories yet
            </h3>
            <p className="mt-1 text-sm text-[var(--color-muted-text)]" style={{ fontFamily: 'var(--font-sans)' }}>
              Create your first category to start tracking specific budgets.
            </p>
            <button
              onClick={openAddCategory}
              disabled={isAtLimit}
              className="mt-6 text-sm font-medium text-[var(--color-muted-emerald)] hover:text-[var(--color-muted-emerald)]/80 transition-colors"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              + Create Category
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-tactical-border)]/50">
            {categories.map((category) => (
              <li
                key={category.id}
                className="flex items-center justify-between p-4 transition-colors hover:bg-[var(--color-abyssal-slate)]/80"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[var(--color-pearl-text)]" style={{ fontFamily: 'var(--font-sans)' }}>
                    {category.name}
                  </span>
                  <span className="text-xs text-[var(--color-muted-text)] mt-0.5" style={{ fontFamily: 'var(--font-sans)' }}>
                    Limit: {category.monthly_limit && category.monthly_limit > 0 ? formatCurrency(category.monthly_limit) : 'Uncapped'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {confirmDeleteId === category.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--color-terracotta)] font-medium">Remove?</span>
                      <button
                        onClick={() => confirmDelete(category)}
                        className="rounded bg-[var(--color-terracotta)] px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-600"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded bg-[var(--color-abyssal-slate)] px-2 py-1 text-xs font-semibold text-[var(--color-pearl-text)] transition-colors hover:bg-gray-600"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => openEditCategory(category.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-muted-text)] transition-colors hover:bg-[var(--color-abyssal-slate)] hover:text-[var(--color-pearl-text)]"
                        aria-label={`Edit ${category.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(category.id)}
                        disabled={deleteCategoryMutation.isPending}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-muted-text)] transition-colors hover:bg-[var(--color-terracotta)]/10 hover:text-[var(--color-terracotta)] disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={`Delete ${category.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

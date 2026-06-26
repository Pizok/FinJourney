'use client';

// =============================================================================
// components/wallet/modals/CreateWalletModal.tsx — FinJourney
//
// Modal for creating a new wallet.
//
// Fields (exact copy per spec):
//   "Wallet Name" | "Starting Balance" | "Description (Optional)" | "Color Accent"
//
// CTAs (exact copy per spec): "Create Wallet" | "Cancel"
//
// Mutations:
//   Real POST /api/v1/wallets is drafted and commented out.
//   Optimistic: addWallet() is called with a temporary ID.
//   Use "// TODO: Uncomment real mutation" marker to find it.
//
// Validation:
//   - Wallet Name: required, max 50 chars.
//   - Starting Balance: required, must be >= 0.
//   - Color Accent: required (defaults to emerald).
// =============================================================================

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BaseModal, FormField, FormInput, FormCurrencyInput, FormTextarea,
  ModalFooter, PrimaryButton, GhostButton,
} from './BaseModal';
import { useWalletStore } from '@/components/finance/stores/walletStore';
import type { ColorToken, Wallet } from '@/types/wallet.types';
import { apiFetchClient } from '@/lib/apiClient.client';

// ---------------------------------------------------------------------------
// Color accent options
// ---------------------------------------------------------------------------

const COLOR_OPTIONS: { token: ColorToken; label: string; cssVar: string }[] = [
  { token: 'emerald',    label: 'Emerald',    cssVar: 'var(--color-muted-emerald)' },
  { token: 'violet',     label: 'Violet',     cssVar: 'var(--color-steel-violet)'  },
  { token: 'gold',       label: 'Gold',       cssVar: 'var(--color-dawn-gold)'     },
  { token: 'slate',      label: 'Slate',      cssVar: 'var(--color-tactical-border)' },
  { token: 'terracotta', label: 'Terracotta', cssVar: 'var(--color-terracotta)'   },
];

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormValues {
  name: string;
  starting_balance: string;
  description: string;
  color_token: ColorToken;
  visible_category_ids: string[];
}

interface FormErrors {
  name?: string;
  starting_balance?: string;
}

const DEFAULTS: FormValues = {
  name: '',
  starting_balance: '',
  description: '',
  color_token: 'emerald',
  visible_category_ids: [],
};

function validate(v: FormValues): FormErrors {
  const e: FormErrors = {};
  if (!v.name.trim())
    e.name = 'Wallet name is required.';
  else if (v.name.trim().length > 50)
    e.name = 'Wallet name must be 50 characters or fewer.';

  const n = parseFloat(v.starting_balance);
  if (v.starting_balance.trim() === '' || isNaN(n))
    e.starting_balance = 'Starting balance is required.';
  else if (n < 0)
    e.starting_balance = 'Balance cannot be a negative number.';

  return e;
}

// ---------------------------------------------------------------------------
// CreateWalletModal
// ---------------------------------------------------------------------------

export function CreateWalletModal() {
  const {
    ui: { isAddWalletOpen },
    wallets,
    featureUnlocks,
    loading,
    closeAddWallet,
    addWallet,
    setLoading,
    setGlobalError,
    categories,
  } = useWalletStore();

  const [values, setValues] = useState<FormValues>(DEFAULTS);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  // Reset form when modal closes
  const handleClose = () => {
    setValues(DEFAULTS);
    setErrors({});
    setSubmitted(false);
    closeAddWallet();
  };

  const set = (key: keyof FormValues, value: string | string[]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (submitted) {
      setErrors(validate({ ...values, [key]: value }));
    }
  };

  const toggleCategory = (categoryId: string) => {
    setValues((prev) => {
      const current = prev.visible_category_ids;
      const next = current.includes(categoryId)
        ? current.filter(id => id !== categoryId)
        : [...current, categoryId];
      return { ...prev, visible_category_ids: next };
    });
  };

  const queryClient = useQueryClient();

  const createWalletMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await apiFetchClient('wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet', 'bootstrap'] });
      handleClose();
    },
    onError: (err: any) => {
      setGlobalError(err.message);
    }
  });

  // -------------------------------------------------------------------------
  // Submit handler
  // -------------------------------------------------------------------------
  const handleSubmit = async () => {
    setSubmitted(true);
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const payload = {
      name:                 values.name.trim(),
      wallet_type:          'bank', // default
      icon:                 values.color_token as ColorToken,
      balance:              Number(values.starting_balance),
      visible_category_ids: values.visible_category_ids,
    };

    createWalletMutation.mutate(payload);
  };

  const isMutating = createWalletMutation.isPending;
  const isAtLimit  = wallets.length >= featureUnlocks.max_wallets && !featureUnlocks.can_create_wallet;

  return (
    <BaseModal
      isOpen={isAddWalletOpen}
      onClose={handleClose}
      title="Create Wallet"
      maxWidth="lg"
    >
      <div className="flex flex-col gap-5">

        {/* Capacity warning — inline when at limit */}
        {isAtLimit && (
          <div className="rounded-lg border border-[var(--color-dawn-gold)]/30 bg-[var(--color-dawn-gold)]/5 px-4 py-3">
            <p className="text-xs text-[var(--color-dawn-gold)]" style={{ fontFamily: 'var(--font-sans)' }}>
              You've reached the wallet limit for your current level. Unlock more at Level 3.
            </p>
          </div>
        )}

        {/* Wallet Name */}
        <FormField label="Wallet Name" htmlFor="wallet-name" error={errors.name} required>
          <FormInput
            id="wallet-name"
            type="text"
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. BCA Savings, Cash, GoPay"
            hasError={Boolean(errors.name)}
            maxLength={50}
            autoComplete="off"
            disabled={isAtLimit}
          />
        </FormField>

        {/* Starting Balance */}
        <FormField
          label="Starting Balance"
          htmlFor="wallet-balance"
          error={errors.starting_balance}
          hint="Enter your current balance. This sets the opening amount for this wallet."
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
              id="wallet-balance"
              value={values.starting_balance}
              onChange={(e) => set('starting_balance', e.target.value)}
              placeholder="0"
              hasError={Boolean(errors.starting_balance)}
              className="pl-9"
              disabled={isAtLimit}
            />
          </div>
        </FormField>

        {/* Description (Optional) */}
        <FormField label="Description (Optional)" htmlFor="wallet-desc">
          <FormTextarea
            id="wallet-desc"
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="e.g. Main bank account for salary and bills"
            maxLength={200}
            disabled={isAtLimit}
          />
        </FormField>

        {/* Color Accent */}
        <div className="flex flex-col gap-2">
          <span
            className="text-sm font-medium text-[var(--color-pearl-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
            id="color-accent-label"
          >
            Color Accent
          </span>
          <div
            role="radiogroup"
            aria-labelledby="color-accent-label"
            className="flex items-center gap-3"
          >
            {COLOR_OPTIONS.map(({ token, label, cssVar }) => {
              const isSelected = values.color_token === token;
              return (
                <button
                  key={token}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={label}
                  onClick={() => set('color_token', token)}
                  disabled={isAtLimit}
                  className={[
                    'flex h-7 w-7 items-center justify-center rounded-full transition-all',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                    'focus-visible:outline-[var(--color-muted-emerald)]',
                    isSelected ? 'ring-2 ring-offset-2 ring-offset-[var(--color-canvas-surface)]' : 'opacity-60 hover:opacity-90',
                    'disabled:cursor-not-allowed',
                  ].join(' ')}
                  style={{
                    backgroundColor: cssVar,
                    // Ring color matches the selected token
                    ...(isSelected ? { outline: `2px solid ${cssVar}`, outlineOffset: '2px' } : {}),
                  }}
                >
                  {isSelected && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                      fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                      aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Categories Selection */}
        {categories.length > 0 && (
          <div className="flex flex-col gap-2">
            <span
              className="text-sm font-medium text-[var(--color-pearl-text)]"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              Tracked Categories
            </span>
            <p className="text-xs text-[var(--color-muted-text)] mb-1" style={{ fontFamily: 'var(--font-sans)' }}>
              Select which categories this wallet should track. You can change this later.
            </p>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--color-tactical-border)] bg-[var(--color-canvas-surface)] p-2">
              <div className="flex flex-col gap-1">
                {categories.map((cat) => (
                  <label
                    key={cat.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-[var(--color-abyssal-slate)]"
                  >
                    <input
                      type="checkbox"
                      checked={values.visible_category_ids.includes(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                      disabled={isAtLimit}
                      className="h-4 w-4 rounded border-[var(--color-tactical-border)] bg-[var(--color-abyssal-slate)] text-[var(--color-muted-emerald)] focus:ring-[var(--color-muted-emerald)] focus:ring-offset-0 disabled:cursor-not-allowed"
                    />
                    <span className="text-sm text-[var(--color-pearl-text)]">{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <ModalFooter>
        <GhostButton onClick={handleClose} disabled={isMutating}>
          Cancel
        </GhostButton>
        <PrimaryButton
          onClick={handleSubmit}
          disabled={isMutating || isAtLimit}
          aria-busy={isMutating}
        >
          {isMutating ? 'Creating…' : 'Create Wallet'}
        </PrimaryButton>
      </ModalFooter>
    </BaseModal>
  );
}


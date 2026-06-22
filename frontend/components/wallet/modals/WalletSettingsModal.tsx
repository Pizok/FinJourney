'use client';

// =============================================================================
// components/wallet/modals/WalletSettingsModal.tsx — FinJourney
//
// Modal for editing an existing wallet's settings.
//
// Fields (exact copy per spec):
//   "Wallet Name" | "Description" | "Default Payment Method" (dropdown)
//   "Visible Categories" (checklist)
//
// CTAs (exact copy per spec): "Save Changes" | "Delete Wallet"
//
// Danger zone:
//   "Delete Wallet" closes this modal and opens DeleteWalletModal via store.
//
// Mutations:
//   Real PATCH /api/v1/wallets/:id is drafted and commented out.
//   Optimistic: updateWallet() is called immediately.
//   Use "// TODO: Uncomment real mutation" marker to find it.
// =============================================================================

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BaseModal, FormField, FormInput, FormTextarea, FormSelect,
  ModalFooter, PrimaryButton, GhostButton, DangerZone,
} from './BaseModal';
import { useWalletStore, selectSettingsWallet } from '@/components/wallet/stores/walletStore';
import type { PaymentMethod } from '@/types/wallet.types';

// ---------------------------------------------------------------------------
// WalletSettingsModal
// ---------------------------------------------------------------------------

export function WalletSettingsModal() {
  const {
    categories,
    loading,
    ui: { isWalletSettingsOpen },
    closeWalletSettings,
    openDeleteWallet,
    updateWallet,
    setLoading,
    setGlobalError,
  } = useWalletStore();

  const wallet = useWalletStore(selectSettingsWallet);

  // -------------------------------------------------------------------------
  // Form state — seeded from the active wallet whenever modal opens
  // -------------------------------------------------------------------------
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [defaultPayment, setDefaultPayment] = useState<PaymentMethod>('transfer');
  const [visibleCategoryIds, setVisibleCategoryIds] = useState<string[]>([]);
  const [nameError, setNameError]     = useState('');

  // Seed form from wallet when it changes (modal opens for a different wallet)
  useEffect(() => {
    if (!wallet) return;
    setName(wallet.name);
    setDescription(wallet.description ?? '');
    setDefaultPayment(wallet.default_payment_method);
    setVisibleCategoryIds(wallet.visible_category_ids);
    setNameError('');
  }, [wallet]);

  const handleClose = () => {
    closeWalletSettings();
  };

  const toggleCategory = (id: string) => {
    setVisibleCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const queryClient = useQueryClient();

  const updateWalletMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!wallet) throw new Error('No wallet selected');
      const response = await fetch(`/api/v1/wallets/${wallet.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to save wallet settings');
      }
      return json.data;
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
  // Submit
  // -------------------------------------------------------------------------
  const handleSave = async () => {
    if (!wallet) return;

    // Validate
    if (!name.trim()) {
      setNameError('Wallet name is required.');
      return;
    }
    if (name.trim().length > 50) {
      setNameError('Wallet name must be 50 characters or fewer.');
      return;
    }
    setNameError('');

    const payload = {
      name:                    name.trim(),
      description:             description.trim() || undefined,
      default_payment_method:  defaultPayment,
      visible_category_ids:    visibleCategoryIds,
    };

    updateWalletMutation.mutate(payload);
  };

  // -------------------------------------------------------------------------
  // Trigger delete flow
  // -------------------------------------------------------------------------
  const handleDeleteClick = () => {
    if (!wallet) return;
    closeWalletSettings();
    openDeleteWallet(wallet.id);
  };

  const isMutating = updateWalletMutation.isPending;

  if (!wallet) return null;

  return (
    <BaseModal
      isOpen={isWalletSettingsOpen}
      onClose={handleClose}
      title="Wallet Settings"
      maxWidth="lg"
    >
      <div className="flex flex-col gap-5">

        {/* Wallet Name */}
        <FormField label="Wallet Name" htmlFor="settings-name" error={nameError} required>
          <FormInput
            id="settings-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError('');
            }}
            hasError={Boolean(nameError)}
            maxLength={50}
            autoComplete="off"
          />
        </FormField>

        {/* Description */}
        <FormField label="Description" htmlFor="settings-desc">
          <FormTextarea
            id="settings-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional note about this wallet's purpose"
            maxLength={200}
          />
        </FormField>

        {/* Default Payment Method — exact dropdown labels per spec */}
        <FormField
          label="Default Payment Method"
          htmlFor="settings-payment"
          hint="Auto-fills the payment method when you add a transaction to this wallet."
        >
          <FormSelect
            id="settings-payment"
            value={defaultPayment}
            onChange={(e) => setDefaultPayment(e.target.value as PaymentMethod)}
          >
            <option value="cash"        style={{ background: 'var(--color-canvas-surface)' }}>Cash</option>
            <option value="debit_card"  style={{ background: 'var(--color-canvas-surface)' }}>Debit Card</option>
            <option value="credit_card" style={{ background: 'var(--color-canvas-surface)' }}>Credit Card</option>
            <option value="transfer"    style={{ background: 'var(--color-canvas-surface)' }}>Bank Transfer</option>
          </FormSelect>
        </FormField>

        {/* Visible Categories checklist */}
        <div className="flex flex-col gap-2">
          {/* Checklist header — exact copy per spec: "Visible Categories" */}
          <span
            className="text-sm font-medium text-[var(--color-pearl-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
            id="visible-cats-label"
          >
            Visible Categories
          </span>
          <p
            className="text-xs text-[var(--color-muted-text)]"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Select which categories appear in the progress bar list when this wallet is active.
          </p>

          {/* Scrollable checklist — max-height prevents modal overflow */}
          <div
            role="group"
            aria-labelledby="visible-cats-label"
            className={[
              'max-h-[200px] overflow-y-auto rounded-lg',
              'border border-[var(--color-tactical-border)]',
              'divide-y divide-[var(--color-tactical-border)]/50',
            ].join(' ')}
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--color-tactical-border) transparent' }}
          >
            {categories.length === 0 ? (
              <p className="px-4 py-3 text-xs text-[var(--color-muted-text)]"
                style={{ fontFamily: 'var(--font-sans)' }}>
                No categories yet.
              </p>
            ) : (
              categories.map((cat) => {
                const checked = visibleCategoryIds.includes(cat.id);
                const labelId = `cat-label-${cat.id}`;
                return (
                  <label
                    key={cat.id}
                    htmlFor={`cat-${cat.id}`}
                    className={[
                      'flex cursor-pointer items-center gap-3 px-4 py-3',
                      'transition-colors hover:bg-[var(--color-abyssal-slate)]',
                    ].join(' ')}
                  >
                    {/* Custom checkbox */}
                    <div className="relative flex-shrink-0">
                      <input
                        type="checkbox"
                        id={`cat-${cat.id}`}
                        checked={checked}
                        onChange={() => toggleCategory(cat.id)}
                        className="sr-only"
                        aria-labelledby={labelId}
                      />
                      <div
                        className={[
                          'flex h-4 w-4 items-center justify-center rounded',
                          'border transition-colors',
                          checked
                            ? 'border-[var(--color-muted-emerald)] bg-[var(--color-muted-emerald)]'
                            : 'border-[var(--color-tactical-border)] bg-[var(--color-abyssal-slate)]',
                        ].join(' ')}
                        aria-hidden="true"
                      >
                        {checked && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                            fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span
                      id={labelId}
                      className="text-sm text-[var(--color-pearl-text)]"
                      style={{ fontFamily: 'var(--font-sans)' }}
                    >
                      {cat.name}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Danger Zone — Delete Wallet                                      */}
        {/* ---------------------------------------------------------------- */}
        <DangerZone>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p
                className="text-sm font-medium text-[var(--color-pearl-text)]"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                Delete Wallet
              </p>
              <p
                className="mt-0.5 text-xs text-[var(--color-muted-text)]"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                Permanently remove this wallet and prevent future transactions.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDeleteClick}
              className={[
                'flex-shrink-0 rounded-lg border border-[var(--color-terracotta)]/50 px-3.5 py-2',
                'text-sm font-medium text-[var(--color-terracotta)]',
                'transition-colors hover:bg-[var(--color-terracotta)]/10',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                'focus-visible:outline-[var(--color-terracotta)]',
              ].join(' ')}
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              Delete Wallet
            </button>
          </div>
        </DangerZone>
      </div>

      {/* Footer */}
      <ModalFooter>
        <GhostButton onClick={handleClose} disabled={isMutating}>Cancel</GhostButton>
        <PrimaryButton onClick={handleSave} disabled={isMutating} aria-busy={isMutating}>
          {isMutating ? 'Saving…' : 'Save Changes'}
        </PrimaryButton>
      </ModalFooter>
    </BaseModal>
  );
}

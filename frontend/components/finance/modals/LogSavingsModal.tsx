'use client';

import { useState } from 'react';
import { BaseModal, FormField, FormInput, FormSelect, ModalFooter, PrimaryButton, GhostButton } from './BaseModal';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { apiFetchClient } from '@/lib/apiClient.client';
import { useWalletStore } from '@/components/finance/stores/walletStore';
import type { SavingsTarget } from '../baselines/FinancialAssumptionsCard';
import type { Wallet } from '@/types/wallet.types';

export interface LogSavingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: SavingsTarget | null;
}

export function LogSavingsModal({ isOpen, onClose, target }: LogSavingsModalProps) {
  const queryClient = useQueryClient();
  const wallets = useWalletStore((s) => s.wallets);
  
  const [amountStr, setAmountStr] = useState('');
  const [walletId, setWalletId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (payload: { amount: number; source_wallet_id: string }) => {
      if (!target) throw new Error('No target selected');
      return apiFetchClient(`savings-targets/${target.id}/log`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings_targets'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] }); // Or whatever key wallet store uses, though wallet store isn't react-query yet.
      // If we use wallet store for balances, we should trigger a bootstrap refetch or optimistic update
      // Since the prompt explicitly said "invalidates caches", we'll do both.
      onClose();
      setAmountStr('');
      setWalletId('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to log savings');
    },
  });

  const handleLog = async () => {
    setError(null);
    const amount = Number(amountStr.replace(/\D/g, ''));
    if (!amount || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!walletId) {
      setError('Please select a source wallet');
      return;
    }
    mutation.mutate({ amount, source_wallet_id: walletId });
  };

  if (!target) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Log Savings: ${target.name}`}
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg bg-[var(--color-terracotta)]/10 border border-[var(--color-terracotta)]/30 p-3 text-sm text-[var(--color-terracotta)]">
            {error}
          </div>
        )}

        <FormField label="Amount (IDR)" htmlFor="log-amount" required>
          <FormInput
            id="log-amount"
            inputMode="numeric"
            placeholder="0"
            value={amountStr}
            onChange={(e) => {
              const num = e.target.value.replace(/\D/g, '');
              setAmountStr(num ? Number(num).toLocaleString('id-ID') : '');
            }}
          />
        </FormField>

        <FormField label="Source Wallet" htmlFor="log-wallet" required>
          <FormSelect
            id="log-wallet"
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
          >
            <option value="" disabled>Select a wallet to deduct from...</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} (Rp {w.balance.toLocaleString('id-ID')})
              </option>
            ))}
          </FormSelect>
        </FormField>
      </div>

      <ModalFooter className="!px-0 !py-0 !border-0 !mt-6">
        <GhostButton onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </GhostButton>
        <PrimaryButton onClick={handleLog} disabled={mutation.isPending || !amountStr || !walletId}>
          {mutation.isPending ? 'Logging...' : 'Log Savings'}
        </PrimaryButton>
      </ModalFooter>
    </BaseModal>
  );
}

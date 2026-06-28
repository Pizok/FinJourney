'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useWalletStore } from '@/components/finance/stores/walletStore';
import { TransactionModalForm } from '@/components/shared/modals/TransactionModalForm';

export function AddTransactionModal() {
  const {
    wallets,
    categories,
    ui: { isAddTransactionOpen },
    closeAddTransaction,
  } = useWalletStore();
  
  const queryClient = useQueryClient();

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['wallet', 'bootstrap'] });
  };

  return (
    <TransactionModalForm
      isOpen={isAddTransactionOpen}
      onClose={closeAddTransaction}
      wallets={wallets}
      categories={categories}
      onSuccess={handleSuccess}
    />
  );
}

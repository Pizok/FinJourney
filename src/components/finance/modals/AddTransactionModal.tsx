'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWalletStore } from '@/components/finance/stores/walletStore';
import { TransactionModalForm } from '@/components/shared/modals/TransactionModalForm';
import { apiFetchClient } from '@/lib/apiClient.client';

export function AddTransactionModal() {
  const {
    wallets,
    categories,
    loans,
    ui: { isAddTransactionOpen },
    closeAddTransaction,
  } = useWalletStore();
  
  const queryClient = useQueryClient();

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['wallet', 'bootstrap'] });
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
  };

  const { data: savingsTargets } = useQuery({
    queryKey: ['savings-targets'],
    queryFn: () => apiFetchClient<any[]>('savings-targets/'),
    enabled: isAddTransactionOpen,
  });

  return (
    <TransactionModalForm
      isOpen={isAddTransactionOpen}
      onClose={closeAddTransaction}
      wallets={wallets}
      categories={categories}
      loans={loans}
      savingsTargets={savingsTargets || []}
      onSuccess={handleSuccess}
    />
  );
}

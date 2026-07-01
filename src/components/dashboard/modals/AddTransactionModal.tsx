'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useDashboardData } from '../hooks/useDashboardData';
import { useDashboardModals } from '../hooks/useDashboardModals';
import { TransactionModalForm } from '@/components/shared/modals/TransactionModalForm';

export function AddTransactionModal({ onClose }: { onClose: () => void }) {
  const { data } = useDashboardData();
  const queryClient = useQueryClient();

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'bootstrap'] });
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
  };

  return (
    <TransactionModalForm
      isOpen={true} // DashboardShell only mounts this when active
      onClose={onClose}
      wallets={(data.wallets || []) as any}
      categories={(data.categories || []) as any}
      onSuccess={handleSuccess}
    />
  );
}

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDashboardModals } from '../hooks/useDashboardModals';
import { apiFetchClient } from '@/lib/apiClient.client';

export function ZeroSpendModal() {
  const { currentModal, closeModal } = useDashboardModals();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      await apiFetchClient('journey/claim/zero-spend', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'bootstrap'] });
      closeModal();
    },
    onError: (err: any) => {
      if (err?.message?.includes('409') || err?.message?.includes('already been claimed')) {
        alert("You've already claimed your zero-spend day for today!");
      } else {
        alert(err.message || 'Failed to claim zero-spend day.');
      }
    }
  });

  if (currentModal !== 'zeroSpend') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={closeModal}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-sm rounded-xl border border-tactical-border bg-canvas-surface p-6 shadow-2xl">
        <h2 className="font-display text-lg font-bold text-pearl-text mb-2">Claim Zero-Spend Day</h2>
        <p className="font-sans text-sm text-muted-text mb-6 leading-relaxed">
          You haven't logged any expenses today. Claiming a zero-spend day will award you XP and increase your streak!
        </p>

        <div className="flex gap-3 justify-end mt-4">
          <button
            onClick={closeModal}
            disabled={mutation.isPending}
            className="px-4 py-2 font-sans text-sm font-medium text-muted-text transition-colors hover:text-pearl-text disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-4 py-2 rounded-lg bg-muted-emerald font-sans text-sm font-medium text-abyssal-slate transition-colors hover:bg-muted-emerald/90 disabled:opacity-50"
          >
            {mutation.isPending ? 'Claiming...' : 'Claim Now'}
          </button>
        </div>
      </div>
    </div>
  );
}

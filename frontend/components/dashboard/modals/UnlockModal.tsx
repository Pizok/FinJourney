'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDashboardModals } from '../hooks/useDashboardModals';
import { useDashboardData } from '../hooks/useDashboardData';
import { apiFetchClient } from '@/lib/apiClient.client';

export function UnlockModal() {
  const { currentModal, closeModal } = useDashboardModals();
  const { data } = useDashboardData();
  const queryClient = useQueryClient();

  const pendingUnlocks = data?.pending_unlocks || [];
  const currentUnlock = pendingUnlocks[0];

  const mutation = useMutation({
    mutationFn: async (unlockId: string) => {
      await apiFetchClient(`journey/unlocks/${unlockId}/acknowledge`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'bootstrap'] });
      // If this was the last unlock, close the modal
      if (pendingUnlocks.length <= 1) {
        closeModal();
      }
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to acknowledge unlock.');
    }
  });

  if (currentModal !== 'unlock' || !currentUnlock) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-sm rounded-xl border border-[var(--color-dawn-gold)] bg-canvas-surface p-8 shadow-[0_0_40px_rgba(212,175,55,0.15)] text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-dawn-gold)]/10 text-[var(--color-dawn-gold)] border border-[var(--color-dawn-gold)]/30">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          </svg>
        </div>

        <h2 className="font-display text-2xl font-bold text-pearl-text mb-2">Level Up!</h2>
        <p className="font-sans text-[var(--color-dawn-gold)] font-medium mb-6">
          Level {currentUnlock.level_reached} Reached
        </p>

        <p className="font-sans text-sm text-muted-text mb-8 leading-relaxed">
          You have unlocked <strong className="text-pearl-text font-semibold">{currentUnlock.feature_key.replace('_', ' ').toUpperCase()}</strong>. Keep up the great work!
        </p>

        <button
          onClick={() => mutation.mutate(currentUnlock.id)}
          disabled={mutation.isPending}
          className="w-full rounded-lg bg-[var(--color-dawn-gold)] px-4 py-3 font-sans text-sm font-bold text-abyssal-slate transition-colors hover:bg-[#E5C158] disabled:opacity-50"
        >
          {mutation.isPending ? 'Acknowledging...' : 'Awesome!'}
        </button>
      </div>
    </div>
  );
}

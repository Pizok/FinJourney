'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetchClient } from '@/lib/apiClient.client';
import { useDashboardModals } from '../hooks/useDashboardModals';

interface DangerModalProps {
  onClose: () => void;
}

export function DangerModal({ onClose }: DangerModalProps) {
  const { openAddTransaction } = useDashboardModals();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const standbyMutation = useMutation({
    mutationFn: async () => {
      return apiFetchClient('journey/standby/use', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'bootstrap'] });
      onClose();
    },
    onError: (err: any) => {
      setErrorMsg(err?.message || 'Failed to activate Standby Mode. Please try again.');
    }
  });

  function handleLogTransaction() {
    onClose();
    openAddTransaction();
  }

  function handleActivateStandby() {
    standbyMutation.mutate();
  }

  return (
    <div className="bg-canvas-surface border border-terracotta/20 rounded-xl p-8 w-full max-w-lg shadow-xl animate-fade-in">
      {/* Icon */}
      <div className="w-10 h-10 rounded-lg bg-terracotta/10 border border-terracotta/20 flex items-center justify-center mb-6">
        <AlertTriangle size={18} strokeWidth={2} className="text-terracotta" />
      </div>

      {/* Title */}
      <h2 className="font-display text-xl font-semibold text-pearl-text mb-3">
        Warning: No Activity Detected
      </h2>

      {/* Body */}
      <p className="font-sans text-sm text-muted-text leading-relaxed mb-8">
        You have not logged any financial activity for 3 days. Your progress
        may begin to decline soon. Record a transaction or activate Standby
        Mode to pause penalties temporarily.
      </p>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          onClick={handleLogTransaction}
          className="w-full flex items-center justify-center px-4 py-3 rounded-lg bg-muted-emerald text-abyssal-slate font-sans text-sm font-medium transition-colors hover:bg-muted-emerald/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-emerald focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface"
          type="button"
        >
          Log Transaction
        </button>

        <button
          onClick={handleActivateStandby}
          disabled={standbyMutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-transparent border border-tactical-border text-pearl-text font-sans text-sm font-medium transition-colors hover:border-steel-violet hover:text-steel-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-steel-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
        >
          {standbyMutation.isPending ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              Activating...
            </>
          ) : (
            'Activate Standby'
          )}
        </button>

        {errorMsg && (
          <p className="text-terracotta text-xs text-center mt-2">{errorMsg}</p>
        )}
      </div>
    </div>
  );
}

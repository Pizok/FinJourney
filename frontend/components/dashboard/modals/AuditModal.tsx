'use client';

import { useState } from 'react';
import { AlertOctagon, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetchClient } from '@/lib/apiClient.client';

export function AuditModal() {
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reviveMutation = useMutation({
    mutationFn: async () => {
      return apiFetchClient('journey/revive', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'bootstrap'] });
    },
    onError: (err: any) => {
      setErrorMsg(err?.message || 'Financial Audit failed. Please check your network and try again.');
    }
  });

  return (
    <div className="bg-canvas-surface border border-terracotta/20 rounded-xl p-8 w-full max-w-lg shadow-xl animate-fade-in relative overflow-hidden">
      {/* Background warning pattern */}
      <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#ef4444_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

      {/* Icon */}
      <div className="w-12 h-12 rounded-lg bg-terracotta/10 border border-terracotta/30 flex items-center justify-center mb-6 relative z-10">
        <AlertOctagon size={24} strokeWidth={2} className="text-terracotta" />
      </div>

      {/* Title */}
      <h2 className="font-display text-2xl font-semibold text-pearl-text mb-3 relative z-10">
        Financial Audit Required
      </h2>

      {/* Body */}
      <div className="font-sans text-sm text-muted-text leading-relaxed mb-8 relative z-10 space-y-4">
        <p>
          Your account has been locked due to critical financial instability (HP reached 0).
          This happens when overspending goes uncorrected for too long.
        </p>
        <p className="p-4 bg-abyssal-slate rounded-lg border border-tactical-border text-pearl-text text-[13px]">
          By proceeding, you acknowledge your overspending. Your progress will be restored to a 
          Hazard state (10 HP), and a permanent strike will be recorded in your journal.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 relative z-10">
        <button
          onClick={() => reviveMutation.mutate()}
          disabled={reviveMutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-terracotta text-pearl-text font-sans text-sm font-medium transition-colors hover:bg-terracotta/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
        >
          {reviveMutation.isPending ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              Running Audit...
            </>
          ) : (
            'Acknowledge & Recover'
          )}
        </button>

        {errorMsg && (
          <p className="text-terracotta text-xs text-center mt-2">{errorMsg}</p>
        )}
      </div>
    </div>
  );
}

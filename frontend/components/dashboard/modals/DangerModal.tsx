'use client';

import { AlertTriangle } from 'lucide-react';
import { useDashboardModals } from '../hooks/useDashboardModals';

interface DangerModalProps {
  onClose: () => void;
}

export function DangerModal({ onClose }: DangerModalProps) {
  const { openAddTransaction } = useDashboardModals();

  function handleLogTransaction() {
    onClose();
    openAddTransaction();
  }

  function handleActivateStandby() {
    // TODO: call POST /api/v1/daily/use-standby, then close
    console.info('[DangerModal] Activating standby...');
    onClose();
  }

  return (
    <div className="bg-canvas-surface border border-terracotta/20 rounded-xl p-8 w-full max-w-md shadow-xl animate-fade-in">
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
          className="w-full flex items-center justify-center px-4 py-3 rounded-lg bg-transparent border border-tactical-border text-pearl-text font-sans text-sm font-medium transition-colors hover:border-steel-violet hover:text-steel-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-steel-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface"
          type="button"
        >
          Activate Standby
        </button>
      </div>
    </div>
  );
}

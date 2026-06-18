'use client';

import Link from 'next/link';
import { SlidersHorizontal, X } from 'lucide-react';

interface TutorialModalProps {
  onClose: () => void;
}

export function TutorialModal({ onClose }: TutorialModalProps) {
  return (
    <div className="bg-canvas-surface border border-tactical-border rounded-xl p-8 w-full max-w-md shadow-xl animate-fade-in">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="w-10 h-10 rounded-lg bg-abyssal-slate border border-tactical-border flex items-center justify-center flex-shrink-0">
          <SlidersHorizontal size={18} strokeWidth={2} className="text-muted-emerald" />
        </div>
        <button
          onClick={onClose}
          className="text-muted-text hover:text-pearl-text transition-colors mt-1 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-border rounded"
          type="button"
          aria-label="Dismiss"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Title */}
      <h2 className="font-display text-xl font-semibold text-pearl-text mb-3">
        Set Up Your Baseline
      </h2>

      {/* Body */}
      <p className="font-sans text-sm text-muted-text leading-relaxed mb-8">
        Your Daily Budget cannot be calculated yet. Add your monthly income,
        regular expenses, and savings target to begin tracking your progress.
      </p>

      {/* CTA */}
      <Link
        href="/baseline"
        onClick={onClose}
        className="w-full flex items-center justify-center px-4 py-3 rounded-lg bg-muted-emerald text-abyssal-slate font-sans text-sm font-medium transition-colors hover:bg-muted-emerald/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-emerald focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface"
      >
        Set Up Baseline
      </Link>
    </div>
  );
}

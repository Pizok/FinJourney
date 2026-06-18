'use client';

import { MapPin } from 'lucide-react';

interface WelcomeModalProps {
  onClose: () => void;
}

export function WelcomeModal({ onClose }: WelcomeModalProps) {
  return (
    <div className="bg-canvas-surface border border-tactical-border rounded-xl p-8 w-full max-w-md shadow-xl animate-fade-in">
      {/* Icon mark */}
      <div className="w-10 h-10 rounded-lg bg-abyssal-slate border border-tactical-border flex items-center justify-center mb-6">
        <MapPin size={18} strokeWidth={2} className="text-muted-emerald" />
      </div>

      {/* Title */}
      <h2 className="font-display text-xl font-semibold text-pearl-text mb-3">
        Welcome to FinJourney
      </h2>

      {/* Body */}
      <p className="font-sans text-sm text-muted-text leading-relaxed mb-8">
        Your financial journey starts here. FinJourney helps you track
        spending, maintain healthy financial habits, and build progress over
        time. Stay within your budget to protect your HP, earn XP through
        consistency, and complete challenges to unlock new features.
      </p>

      {/* CTA */}
      <button
        onClick={onClose}
        className="w-full flex items-center justify-center px-4 py-3 rounded-lg bg-muted-emerald text-abyssal-slate font-sans text-sm font-medium transition-colors hover:bg-muted-emerald/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-emerald focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface"
        type="button"
      >
        Start Journey
      </button>
    </div>
  );
}

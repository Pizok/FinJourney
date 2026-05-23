'use client';

// components/onboarding/StepPrologue.tsx

import React from 'react';
import { Button }     from '@/components/ui/button';
import { SectionTag } from '@/components/ui/label';

interface StepPrologueProps {
  onNext: () => void;
}

export default function StepPrologue({ onNext }: StepPrologueProps) {
  return (
    <div className="max-w-xl mx-auto text-center space-y-10">
      {/* Icon */}
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full border border-refreshing-teal/30 bg-refreshing-teal/5 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-refreshing-teal">
            <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.5" />
            <path d="M14 8v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Text */}
      <div className="space-y-4">
        <div className="flex justify-center">
          <SectionTag>Prologue</SectionTag>
        </div>

        <h1 className="font-display font-semibold text-4xl text-starlight-text tracking-tight leading-tight">
          Your Financial Life is Now Visible
        </h1>

        <p className="font-sans text-base text-muted-text leading-relaxed">
          Welcome to FinJourney. From this moment, your daily spending is no
          longer invisible. Every decision affects your progress. Stay within
          your budget to build stability and momentum. Overspending will slow
          your progress, but consistency will move you forward.
        </p>
      </div>

      {/* Divider line */}
      <div className="flex items-center gap-4 max-w-xs mx-auto">
        <div className="flex-1 h-px bg-clean-border" />
        <div className="w-1.5 h-1.5 rounded-full bg-refreshing-teal/50" />
        <div className="flex-1 h-px bg-clean-border" />
      </div>

      <Button size="lg" onClick={onNext} className="min-w-[220px]">
        Begin the Journey
      </Button>
    </div>
  );
}

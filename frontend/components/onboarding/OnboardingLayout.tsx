'use client';
// components/onboarding/OnboardingLayout.tsx
//
// Guided / structured atmosphere — flat Canvas Surface card on Abyssal Slate.
// No star-fields, no radial glows, no glassmorphism.
// Step indicator: muted pips that grow and tint on completion / active states.

import React from 'react';

interface OnboardingLayoutProps {
  children: React.ReactNode;
  /** Current wizard step (1–totalSteps). Drives the pip indicator. */
  step?: number;
  totalSteps?: number;
}

export default function OnboardingLayout({
  children,
  step,
  totalSteps = 4,
}: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen bg-abyssal-slate flex flex-col items-center justify-center px-6 py-16">

      {/* Step pip track */}
      {step !== undefined && (
        <div className="flex gap-1.5 mb-10" role="progressbar" aria-valuenow={step} aria-valuemax={totalSteps}>
          {Array.from({ length: totalSteps }).map((_, i) => {
            const done   = i + 1 < step;
            const active = i + 1 === step;
            return (
              <div
                key={i}
                className={[
                  'h-[3px] rounded-full transition-all duration-300',
                  done   ? 'w-6  bg-muted-emerald'  : '',
                  active ? 'w-8  bg-muted-emerald'  : '',
                  !done && !active ? 'w-4 bg-tactical-border' : '',
                ].join(' ')}
              />
            );
          })}
        </div>
      )}

      {/* Content — children supply their own card */}
      <div className="w-full">{children}</div>
    </div>
  );
}

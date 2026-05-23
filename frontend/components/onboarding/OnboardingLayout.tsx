'use client';

// components/onboarding/OnboardingLayout.tsx
// Centered container with star-field background and optional step indicator.

import React from 'react';

interface OnboardingLayoutProps {
  children: React.ReactNode;
  step?: number;   // 1–4, shown in the progress dots
  totalSteps?: number;
}

export default function OnboardingLayout({
  children,
  step,
  totalSteps = 4,
}: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen bg-midnight-sky flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Background effects */}
      <div className="star-field" />
      <div className="grid-overlay absolute inset-0 opacity-20" />

      {/* Radial glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(45,212,191,0.04) 0%, transparent 70%)',
        }}
      />

      {/* Step dots */}
      {step !== undefined && (
        <div className="relative z-10 flex gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={[
                'h-1 rounded-full transition-all duration-300',
                i + 1 < step
                  ? 'w-6 bg-refreshing-teal'
                  : i + 1 === step
                  ? 'w-8 bg-refreshing-teal'
                  : 'w-4 bg-clean-border',
              ].join(' ')}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}

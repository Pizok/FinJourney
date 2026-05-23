'use client';

// components/onboarding/StepPath.tsx

import React from 'react';
import { Shield, Zap, Ghost } from 'lucide-react';
import { Button }     from '@/components/ui/button';
import { FieldError, SectionTag } from '@/components/ui/label';
import type { OnboardingState } from './types';

type PathKey = 'Sentinel' | 'Catalyst' | 'Phantom';

interface PathOption {
  key: PathKey;
  icon: React.ReactNode;
  heading: string;
  description: string;
  accent: string;
}

const PATHS: PathOption[] = [
  {
    key: 'Sentinel',
    icon: <Shield size={22} strokeWidth={2} />,
    heading: 'Sentinel',
    description:
      'Focus on stability. Helps you build safety through strong budgeting and emergency readiness.',
    accent: 'border-refreshing-teal text-refreshing-teal',
  },
  {
    key: 'Catalyst',
    icon: <Zap size={22} strokeWidth={2} />,
    heading: 'Catalyst',
    description:
      'Focus on growth. Helps you increase income potential and improve long-term financial performance.',
    accent: 'border-dawn-gold text-dawn-gold',
  },
  {
    key: 'Phantom',
    icon: <Ghost size={22} strokeWidth={2} />,
    heading: 'Phantom',
    description:
      'Focus on simplicity. Helps you reduce unnecessary spending and optimize financial efficiency.',
    accent: 'border-muted-text text-muted-text',
  },
];

// Avatar styles for the toggle placeholder
const AVATAR_CLASSES = ['Sentinel', 'Catalyst', 'Phantom'] as const;

interface StepPathProps {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
}

export default function StepPath({ state, onChange, onNext }: StepPathProps) {
  const [avatarIndex, setAvatarIndex] = React.useState(0);
  const [attempted,  setAttempted]    = React.useState(false);

  const handleConfirm = () => {
    setAttempted(true);
    if (!state.selectedPath) return;
    onNext();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <SectionTag>Identity</SectionTag>
        <h1 className="font-display font-semibold text-3xl text-starlight-text tracking-tight">
          Choose Your Financial Path
        </h1>
        <p className="font-sans text-sm text-muted-text max-w-md mx-auto leading-relaxed">
          Pick a style that matches how you want to manage money. This will
          shape your experience and recommendations.
        </p>
      </div>

      {/* Two-column: path cards + avatar panel */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Path cards */}
        <div className="flex-1 space-y-4">
          {PATHS.map((p) => {
            const selected = state.selectedPath === p.key;
            return (
              <button
                key={p.key}
                onClick={() => {
                  onChange({ selectedPath: p.key });
                  setAttempted(false);
                }}
                className={[
                  'w-full text-left rounded-xl border p-5 transition-all duration-200 cursor-pointer',
                  'bg-slate-canvas hover:brightness-110',
                  selected
                    ? `${p.accent} bg-opacity-5`
                    : 'border-clean-border',
                ].join(' ')}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={[
                      'mt-0.5 shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center',
                      selected ? p.accent : 'border-clean-border text-muted-text',
                    ].join(' ')}
                  >
                    {p.icon}
                  </div>
                  <div>
                    <h3
                      className={[
                        'font-display font-semibold text-base mb-1',
                        selected ? p.accent.split(' ')[1] : 'text-starlight-text',
                      ].join(' ')}
                    >
                      {p.heading}
                    </h3>
                    <p className="font-sans text-sm text-muted-text leading-relaxed">
                      {p.description}
                    </p>
                  </div>

                  {/* Selection indicator */}
                  <div className="ml-auto shrink-0 mt-1">
                    <div
                      className={[
                        'w-4 h-4 rounded-full border-2 transition-colors duration-150',
                        selected
                          ? 'border-refreshing-teal bg-refreshing-teal'
                          : 'border-clean-border',
                      ].join(' ')}
                    />
                  </div>
                </div>
              </button>
            );
          })}

          {attempted && !state.selectedPath && (
            <FieldError message="Please select a path to continue." />
          )}
        </div>

        {/* Avatar panel */}
        <div className="lg:w-64 bg-slate-canvas border border-clean-border rounded-xl p-6 flex flex-col items-center gap-5">
          <div className="text-center">
            <h3 className="font-display font-semibold text-sm text-starlight-text mb-1">
              Your Traveler
            </h3>
            <p className="font-sans text-xs text-muted-text leading-relaxed">
              Explore your traveler identity. This represents your financial
              journey, not your actual money.
            </p>
          </div>

          {/* Avatar placeholder illustration */}
          <div className="relative w-28 h-28">
            <div className="absolute inset-0 rounded-full border border-refreshing-teal/20" />
            <div className="w-full h-full rounded-full bg-midnight-sky border border-clean-border flex items-center justify-center">
              <div className="text-4xl select-none">
                {avatarIndex === 0 ? '🛡' : avatarIndex === 1 ? '⚡' : '👁'}
              </div>
            </div>
          </div>

          <p className="font-display font-semibold text-refreshing-teal text-sm">
            {AVATAR_CLASSES[avatarIndex]}
          </p>

          {/* Slider / toggle */}
          <div className="flex gap-2">
            {AVATAR_CLASSES.map((_, i) => (
              <button
                key={i}
                onClick={() => setAvatarIndex(i)}
                className={[
                  'w-6 h-6 rounded-full border transition-all duration-150 cursor-pointer',
                  avatarIndex === i
                    ? 'border-refreshing-teal bg-refreshing-teal/20'
                    : 'border-clean-border',
                ].join(' ')}
              />
            ))}
          </div>

          <p className="font-sans text-xs text-muted-text/60 text-center leading-relaxed">
            Cosmetic only — identity is determined by your selected path.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="flex justify-center">
        <Button size="lg" className="min-w-[220px]" onClick={handleConfirm}>
          Confirm Your Path
        </Button>
      </div>
    </div>
  );
}

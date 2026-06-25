'use client';
// app/onboarding/page.tsx
//
// Orchestrates all onboarding steps using local React state only.
// No Zustand, no global store — compatible for future migration.
//
// Design contract:
//   • OnboardingLayout owns the Abyssal Slate background + pip track.
//   • Each Step component renders its own Canvas Surface card (max-w-[540px] mx-auto).
//   • No cinematic effects, blobs, or glows anywhere in this subtree.

import React from 'react';
import { useRouter } from 'next/navigation';

import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import StepPrologue     from '@/components/onboarding/StepPrologue';
import StepPath         from '@/components/onboarding/StepPath';
import StepBaseline     from '@/components/onboarding/StepBaseline';
import StepReview       from '@/components/onboarding/StepReview';

import { INITIAL_STATE, OnboardingState } from '@/components/onboarding/types';

import { apiFetchClient } from '@/lib/apiClient.client';

// Wizard steps:
//  1 = Prologue
//  2 = Path selection
//  3 = Baseline (sub-stepped internally)
//  4 = Review
type Step = 1 | 2 | 3 | 4;

// When the user wants to edit from the Review screen we store which
// sub-step of baseline to jump to on re-entry.
type BaselineJumpTarget = 'income' | 'fixed' | 'savings' | null;

export default function OnboardingPage() {
  const router = useRouter();

  const [step,      setStep]      = React.useState<Step>(1);
  const [formState, setFormState] = React.useState<OnboardingState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Baseline sub-step jump — passed via a ref trick to StepBaseline
  const baselineJumpRef = React.useRef<BaselineJumpTarget>(null);

  const patch = (p: Partial<OnboardingState>) =>
    setFormState((prev) => ({ ...prev, ...p }));

  const handleFinished = async () => {
    try {
      setIsSubmitting(true);
      
      // 1. Setup Profile
      await apiFetchClient('profile/setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formState.username,
          avatar_class: formState.selectedPath || 'Sentinel',
          avatar_key: formState.selectedAvatar || 'Roan',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      });

      // 2. Save Baselines (only runs if setup succeeds)
      await apiFetchClient('profile/baselines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incomeEntries: formState.incomeEntries,
          fixedCostEntries: formState.fixedCostEntries,
          savingsTarget: formState.savingsEntries.reduce((acc, entry) => acc + entry.target_amount, 0),
        })
      });

      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      setIsSubmitting(false);
      // In a real app we'd set a global error banner here
    }
  };

  // ── Edit shortcuts from Review screen ──────────────────────────────────
  const jumpToBaseline = (target: BaselineJumpTarget) => {
    baselineJumpRef.current = target;
    setStep(3);
  };

  return (
    <OnboardingLayout step={step}>
      {step === 1 && (
        <StepPrologue state={formState} onChange={patch} onNext={() => setStep(2)} />
      )}

      {step === 2 && (
        <StepPath
          state={formState}
          onChange={patch}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <StepBaseline
          state={formState}
          onChange={patch}
          jumpTo={baselineJumpRef.current}
          onNext={() => {
            baselineJumpRef.current = null;
            setStep(4);
          }}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && (
        <StepReview
          state={formState}
          isSubmitting={isSubmitting}
          onConfirm={handleFinished}
          onBack={() => setStep(3)}
          onEditPath={()         => setStep(2)}
          onEditIncome={()       => jumpToBaseline('income')}
          onEditFixed={()        => jumpToBaseline('fixed')}
          onEditSavings={()      => jumpToBaseline('savings')}
        />
      )}
    </OnboardingLayout>
  );
}

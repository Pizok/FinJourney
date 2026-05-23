'use client';

// app/onboarding/page.tsx
// Orchestrates all onboarding steps using local React state only.
// No Zustand, no global store — compatible for future migration.

import React from 'react';
import { useRouter } from 'next/navigation';

import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import StepPrologue     from '@/components/onboarding/StepPrologue';
import StepPath         from '@/components/onboarding/StepPath';
import StepBaseline     from '@/components/onboarding/StepBaseline';
import StepReview       from '@/components/onboarding/StepReview';
import { INITIAL_STATE, OnboardingState } from '@/components/onboarding/types';

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

  const [step,        setStep]        = React.useState<Step>(1);
  const [formState,   setFormState]   = React.useState<OnboardingState>(INITIAL_STATE);
  // Baseline sub-step jump — passed via a ref trick to StepBaseline
  const baselineJumpRef = React.useRef<BaselineJumpTarget>(null);

  const patch = (p: Partial<OnboardingState>) =>
    setFormState((prev) => ({ ...prev, ...p }));

  const handleFinished = () => {
    // TODO: POST /profile/setup + /baselines when real auth exists.
    router.push('/dashboard');
  };

  // ── Edit shortcuts from Review screen ──
  const jumpToBaseline = (target: BaselineJumpTarget) => {
    baselineJumpRef.current = target;
    setStep(3);
  };

  return (
    <OnboardingLayout step={step}>
      {step === 1 && (
        <StepPrologue onNext={() => setStep(2)} />
      )}

      {step === 2 && (
        <StepPath
          state={formState}
          onChange={patch}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <StepBaseline
          state={formState}
          onChange={patch}
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
          onConfirm={handleFinished}
          onBack={() => setStep(3)}
          onEditIncome={() => jumpToBaseline('income')}
          onEditFixed={() => jumpToBaseline('fixed')}
          onEditSavings={() => jumpToBaseline('savings')}
        />
      )}
    </OnboardingLayout>
  );
}

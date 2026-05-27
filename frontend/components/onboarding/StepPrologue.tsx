'use client';
// components/onboarding/StepPrologue.tsx
//
// Layout rules applied:
//   • Left-aligned card content (not centered) — matches the rest of the wizard.
//   • Icon: flat bg-muted-emerald/8 + border-muted-emerald/20, no glow.
//   • Heading uses h2 (wizard card context — h1 lives at the page/document level).
//   • Decorative divider removed; spacing via mb utilities alone.
//   • Button: standard PrimaryButton from OnboardingCard primitives.

import React from 'react';
import { Map } from 'lucide-react';
import {
  OnboardingCard,
  LabelTag,
  StepHeading,
  StepSubtitle,
  PrimaryButton,
  GhostButton,
} from './OnboardingCard';

interface StepPrologueProps {
  onNext: () => void;
}

const FEATURES = [
  'Track daily spending against a budget built for your life',
  'Earn XP for discipline, lose HP when you overspend',
  'Quarterly reviews and challenge events keep you accountable',
] as const;

export default function StepPrologue({ onNext }: StepPrologueProps) {
  return (
    <OnboardingCard>
      {/* Icon — flat tinted square, no shadow or glow */}
      <div className="w-12 h-12 rounded-[10px] bg-muted-emerald/8 border border-muted-emerald/20 flex items-center justify-center mb-6">
        <Map size={22} strokeWidth={2} className="text-muted-emerald" />
      </div>

      <LabelTag>Welcome</LabelTag>

      {/* h2 — wizard steps sit inside a card; h1 is reserved for the document */}
      <StepHeading>Your financial life is now visible</StepHeading>

      <StepSubtitle>
        Set up takes two minutes. Choose a path, enter your baseline, and
        unlock your daily budget.
      </StepSubtitle>

      {/* Feature list — dots + muted text, no icons */}
      <ul className="flex flex-col gap-2.5 mb-8 list-none">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[13px] text-muted-text leading-relaxed">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-emerald flex-shrink-0 mt-[6px]" />
            {f}
          </li>
        ))}
      </ul>

      <PrimaryButton onClick={onNext}>Begin setup</PrimaryButton>

      <div className="text-center mt-3.5">
        <GhostButton
          className="text-[12px] mx-auto"
          onClick={() => { /* skip handler wired in page */ }}
        >
          Skip and explore on my own
        </GhostButton>
      </div>
    </OnboardingCard>
  );
}

'use client';
// components/onboarding/StepPrologue.tsx
//
// Layout rules applied:
//   • Left-aligned card content (not centered) — matches the rest of the wizard.
//   • Icon: flat bg-muted-emerald/8 + border-muted-emerald/20, no glow.
//   • Heading uses h2 (wizard card context — h1 lives at the page/document level).
//   • Decorative divider removed; spacing via mb utilities alone.
//   • Button: standard PrimaryButton from OnboardingCard primitives.

import React, { useEffect, useState } from 'react';
import { Map, User } from 'lucide-react';
import {
  OnboardingCard,
  LabelTag,
  StepHeading,
  StepSubtitle,
  PrimaryButton,
} from './OnboardingCard';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { OnboardingState } from './types';
import { apiFetchClient } from '@/lib/apiClient.client';

interface StepPrologueProps {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onNext: () => void;
}

const FEATURES = [
  'Track daily spending against a budget built for your life',
  'Earn XP for discipline, lose HP when you overspend',
  'Quarterly reviews and challenge events keep you accountable',
] as const;

export default function StepPrologue({ state, onChange, onNext }: StepPrologueProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const username = state.username.trim();
    if (username.length === 0) {
      setErrorMsg(null);
      setIsValid(false);
      return;
    }

    // Client-side regex pre-check
    const isValidRegex = /^[a-zA-Z0-9_-]+$/.test(username);
    if (username.length < 3 || username.length > 20 || !isValidRegex) {
      setErrorMsg('3–20 chars, letters, numbers, -, _ only');
      setIsValid(false);
      return;
    }

    setErrorMsg(null);
    setIsChecking(true);
    setIsValid(false);

    const timer = setTimeout(async () => {
      try {
        const res = await apiFetchClient<{ success: boolean; data: { available: boolean; reason?: string } }>(
          `profile/check-username?username=${encodeURIComponent(username)}`
        );
        if (res && res.data) {
          if (res.data.available) {
            setIsValid(true);
            setErrorMsg(null);
          } else {
            setIsValid(false);
            setErrorMsg(res.data.reason || 'Username is already taken');
          }
        }
      } catch (err) {
        setErrorMsg('Error checking username');
        setIsValid(false);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [state.username]);

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
      <ul className="flex flex-col gap-2.5 mb-6 list-none">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[13px] text-muted-text leading-relaxed">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-emerald flex-shrink-0 mt-[6px]" />
            {f}
          </li>
        ))}
      </ul>

      {/* Username Field */}
      <div className="flex flex-col gap-1.5 mb-8">
        <Label htmlFor="username">Choose a username</Label>
        <Input
          id="username"
          type="text"
          placeholder="your_name"
          icon={<User size={16} />}
          value={state.username}
          onChange={(e) => onChange({ username: e.target.value })}
          error={!!errorMsg}
        />
        {isChecking && <p className="text-xs text-muted-text mt-1">Checking availability...</p>}
        {errorMsg && <FieldError message={errorMsg} />}
        {!errorMsg && !isChecking && isValid && (
          <p className="text-xs text-muted-emerald mt-1">Username is available!</p>
        )}
      </div>

      <PrimaryButton onClick={onNext} disabled={!isValid || isChecking}>
        Begin setup
      </PrimaryButton>
    </OnboardingCard>
  );
}

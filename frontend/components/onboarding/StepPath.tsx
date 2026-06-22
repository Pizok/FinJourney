'use client';
// components/onboarding/StepPath.tsx
//
// Layout: side-by-side CSS grid (2 equal columns). Stacks on mobile.
//
// Avatar interaction (RPG character-select pattern):
//   • Left/Right arrows cycle through avatars — no slider, no scroll-snap.
//   • Preview area (image + arrows + pips): locked in place, content swaps.
//   • Lore area (name + story): locked container, text updates dynamically.
//   • Avatar choice is fully independent of path selection.
//
// Flat surface rules:
//   • All containers: Canvas Surface bg + 1px Tactical Border. No shadows.
//   • Selected path: Muted Emerald border only. No glow.
//   • Arrow buttons: flat Abyssal Slate bg + Tactical Border.

import React from 'react';
import Image from 'next/image';
import {
  Shield, Zap, Ghost,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { FieldError } from '@/components/ui/label';
import {
  OnboardingCard,
  LabelTag,
  StepHeading,
  StepSubtitle,
  ButtonRow,
} from './OnboardingCard';
import type { OnboardingState } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

type PathKey   = 'Sentinel' | 'Catalyst' | 'Phantom';
type AvatarKey = 'Roan' | 'Lyss';

// ── Path data ─────────────────────────────────────────────────────────────────

interface PathConfig {
  key:         PathKey;
  Icon:        React.FC<{ size: number; strokeWidth: number; className?: string }>;
  heading:     string;
  description: string;
}

const PATHS: PathConfig[] = [
  {
    key:         'Sentinel',
    Icon:        Shield,
    heading:     'Sentinel',
    description: 'Defensive. Bonus shield generation and emergency fund bonuses.',
  },
  {
    key:         'Catalyst',
    Icon:        Zap,
    heading:     'Catalyst',
    description: 'Aggressive growth. Income expansion and investment track bonuses.',
  },
  {
    key:         'Phantom',
    Icon:        Ghost,
    heading:     'Phantom',
    description: 'Efficiency. Reduced penalties and minimalist spending bonuses.',
  },
];

// ── Avatar data ───────────────────────────────────────────────────────────────

// Icon is a lucide-react component standing in for real character art.
// When assets are ready, swap the Icon render inside AvatarPreview with:
//   <Image src={config.imageSrc} alt={config.name} width={88} height={88} />

interface AvatarConfig {
  key:  AvatarKey;
  Icon: React.FC<{ size: number; strokeWidth: number; className?: string }>;
  name: string;
  story: string;
}

const AVATARS: AvatarConfig[] = [
  {
    key:   'Roan',
    Icon:  ({ size, className }) => (
      <Image 
        src="/profil/Untitled design (5).png" 
        alt="Roan" 
        width={size} 
        height={size} 
        className={`object-cover ${className || ''}`}
        priority
      />
    ),
    name:  'Roan',
    story: 'An experienced navigator who reads markets like weather and never panics. Steady hands and a long horizon guide every decision.',
  },
  {
    key:   'Lyss',
    Icon:  ({ size, className }) => (
      <Image 
        src="/profil/Untitled design (4).png" 
        alt="Lyss" 
        width={size} 
        height={size} 
        className={`object-cover ${className || ''}`}
        priority
      />
    ),
    name:  'Lyss',
    story: 'Light-footed and free. She travels with minimal weight and maximum joy — and somehow always lands exactly where she needs to be.',
  },
];

// ── PathRow ───────────────────────────────────────────────────────────────────

function PathRow({
  config,
  selected,
  onSelect,
}: {
  config:   PathConfig;
  selected: boolean;
  onSelect: () => void;
}) {
  const { Icon, heading, description } = config;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex items-start gap-3 w-full text-left',
        'rounded-[10px] border p-3.5 transition-colors duration-150 bg-abyssal-slate',
        selected
          ? 'border-muted-emerald bg-muted-emerald/[0.05]'
          : 'border-tactical-border hover:border-[#475569]',
      ].join(' ')}
    >
      {/* Icon box */}
      <div className={[
        'w-8 h-8 rounded-[6px] flex items-center justify-center flex-shrink-0 border transition-colors duration-150',
        selected
          ? 'bg-muted-emerald/10 border-muted-emerald'
          : 'bg-canvas-surface border-tactical-border',
      ].join(' ')}>
        <Icon size={15} strokeWidth={2} className={selected ? 'text-muted-emerald' : 'text-muted-text'} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <h3 className={[
          'font-display text-[13px] font-semibold mb-0.5',
          selected ? 'text-muted-emerald' : 'text-pearl-text',
        ].join(' ')}>
          {heading}
        </h3>
        <p className="text-[11px] text-muted-text leading-relaxed">{description}</p>
      </div>

      {/* Radio */}
      <div className={[
        'w-[14px] h-[14px] rounded-full border-[1.5px] flex-shrink-0 mt-0.5 transition-all duration-150',
        selected
          ? 'border-muted-emerald bg-muted-emerald'
          : 'border-tactical-border bg-transparent',
      ].join(' ')} />
    </button>
  );
}

// ── AvatarPanel ───────────────────────────────────────────────────────────────
// Two locked sub-sections:
//   1. Preview: image placeholder + arrows + pips — the frame never moves.
//   2. Lore: name + story — the container is static, text content updates.

function AvatarPanel() {
  const [index, setIndex] = React.useState(0);

  const cycle = (dir: -1 | 1) =>
    setIndex((i) => (i + dir + AVATARS.length) % AVATARS.length);

  const avatar = AVATARS[index];
  const { Icon } = avatar;

  return (
    <div className="flex flex-col gap-2.5">

      {/* ── Preview area ───────────────────────────────────────────────── */}
      {/* This container is fixed in place — only the icon inside swaps. */}
      <div className="bg-abyssal-slate border border-tactical-border rounded-[10px] p-5 flex flex-col items-center gap-4">
        {/* Image placeholder — 88×88 flat square */}
        <div className="w-[88px] h-[88px] rounded-[10px] bg-canvas-surface border border-tactical-border flex items-center justify-center overflow-hidden">
          <Icon size={88} strokeWidth={1.75} className="" />
        </div>

        {/* Arrow controls + pips in one row */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => cycle(-1)}
            aria-label="Previous avatar"
            className="w-8 h-8 rounded-[7px] bg-canvas-surface border border-tactical-border flex items-center justify-center hover:border-[#475569] transition-colors"
          >
            <ChevronLeft size={14} strokeWidth={2} className="text-muted-text" />
          </button>

          {/* Pip track */}
          <div className="flex gap-1" role="presentation" aria-hidden="true">
            {AVATARS.map((_, i) => (
              <div
                key={i}
                className={[
                  'h-[3px] rounded-full transition-all duration-200',
                  i === index ? 'w-5 bg-muted-emerald' : 'w-2.5 bg-tactical-border',
                ].join(' ')}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => cycle(1)}
            aria-label="Next avatar"
            className="w-8 h-8 rounded-[7px] bg-canvas-surface border border-tactical-border flex items-center justify-center hover:border-[#475569] transition-colors"
          >
            <ChevronRight size={14} strokeWidth={2} className="text-muted-text" />
          </button>
        </div>
      </div>

      {/* ── Lore area ──────────────────────────────────────────────────── */}
      {/* Static container — only the text content changes with each avatar. */}
      <div className="bg-canvas-surface border border-tactical-border rounded-[10px] p-4">
        {/* Name updates — uses transition for a subtle fade between avatars */}
        <p
          key={avatar.name}        // key forces remount → CSS animation triggers
          className="font-display text-[14px] font-semibold text-muted-emerald mb-1.5 animate-fade-in"
        >
          {avatar.name}
        </p>
        <p className="text-[12px] text-muted-text leading-relaxed">
          {avatar.story}
        </p>
      </div>

      <p className="text-[11px] text-muted-text/60 text-center">
        Cosmetic only — change anytime from your profile
      </p>
    </div>
  );
}

// ── StepPath ──────────────────────────────────────────────────────────────────

interface StepPathProps {
  state:    OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
  onNext:   () => void;
  onBack:   () => void;
}

export default function StepPath({ state, onChange, onNext, onBack }: StepPathProps) {
  const [attempted, setAttempted] = React.useState(false);

  const handleSelectPath = (key: PathKey) => {
    onChange({ selectedPath: key });
    setAttempted(false);
  };

  const handleConfirm = () => {
    setAttempted(true);
    if (!state.selectedPath) return;
    onNext();
  };

  return (
    /*
      Two-column grid:
        Left  — Financial strategy selection (flex-1)
        Right — Avatar RPG select (fixed ~300px, shrinks on narrow screens)
      Stacks vertically below lg breakpoint.
    */
    <div className="mx-auto w-full max-w-[780px] grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">

      {/* ── Left: Financial strategy ───────────────────────────────────── */}
      <OnboardingCard>
        <LabelTag>Financial path</LabelTag>
        <StepHeading>Choose your strategy</StepHeading>
        <StepSubtitle>
          Your path shapes how the game rewards and penalises you. Locked for
          six months after selection.
        </StepSubtitle>

        <div className="flex flex-col gap-2">
          {PATHS.map((p) => (
            <PathRow
              key={p.key}
              config={p}
              selected={state.selectedPath === p.key}
              onSelect={() => handleSelectPath(p.key)}
            />
          ))}
        </div>

        {attempted && !state.selectedPath && (
          <FieldError message="Please select a path to continue." />
        )}

        <ButtonRow
          onBack={onBack}
          primaryLabel="Confirm and continue"
          onPrimary={handleConfirm}
        />
      </OnboardingCard>

      {/* ── Right: Avatar RPG select ────────────────────────────────────── */}
      {/*
        Not wrapped in OnboardingCard so it doesn't carry the card's p-8 padding —
        the avatar panel has its own internal sub-sections.
      */}
      <div className="bg-canvas-surface border border-tactical-border rounded-xl p-6 flex flex-col gap-0">
        <LabelTag>Traveler</LabelTag>
        <StepHeading>Choose your avatar</StepHeading>
        <StepSubtitle>
          Cosmetic only — no effect on gameplay or rewards.
        </StepSubtitle>

        <AvatarPanel />
      </div>

    </div>
  );
}

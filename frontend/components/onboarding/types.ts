'use client';

// components/onboarding/types.ts
// Shared state shape for the onboarding wizard.

export interface BaselineEntry {
  id: string;
  label: string;
  amount: number;
}

export interface SavingsEntry {
  id: string;
  label: string;
  target_amount: number;
  monthly_contribution: number;
  deadline: string;
}

export interface OnboardingState {
  // Step 1
  username: string;

  // Step 2
  selectedPath: 'sentinel' | 'phantom' | 'vanguard' | null;
  selectedAvatar: 'Roan' | 'Lyss' | null;

  // Step 3A
  incomeEntries: BaselineEntry[];

  // Step 3B
  fixedCostEntries: BaselineEntry[];

  // Step 3C
  savingsEntries: SavingsEntry[];
}

export const INITIAL_STATE: OnboardingState = {
  username: '',
  selectedPath: null,
  selectedAvatar: 'Roan',
  incomeEntries: [{ id: '1', label: 'Monthly Salary', amount: 0 }],
  fixedCostEntries: [
    { id: '1', label: 'Rent / Mortgage', amount: 0 },
    { id: '2', label: 'Utilities',       amount: 0 },
  ],
  savingsEntries: [],
};

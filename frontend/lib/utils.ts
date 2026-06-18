/**
 * lib/utils.ts
 *
 * Shared utility helpers for FinJourney frontend.
 *
 * cn() — classname merging
 *   Combines clsx (conditional class logic) with tailwind-merge (resolves
 *   conflicting Tailwind utility classes). Used everywhere components need
 *   to conditionally compose className strings.
 *
 * Usage:
 *   import { cn } from '@/lib/utils'
 *   <div className={cn('base-class', condition && 'conditional-class')} />
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

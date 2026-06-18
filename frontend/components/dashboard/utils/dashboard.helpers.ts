import type { TransactionType } from '../types/dashboard.types';

// ─── Currency ──────────────────────────────────────────────────────────────────

/**
 * Format a numeric amount as IDR currency.
 * Output: "Rp 85.000" (Indonesian locale, no decimals).
 */
export function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
  return `Rp ${formatted}`;
}

/**
 * Format amount with a directional sign prefix for transaction rows.
 * Income: "+Rp 500.000", Expense: "-Rp 45.000", Transfer: "Rp 100.000"
 */
export function formatTransactionAmount(
  amount: number,
  type: TransactionType
): string {
  const base = formatCurrency(amount);
  if (type === 'income') return `+${base}`;
  if (type === 'expense') return `\u2212${base}`;
  return base;
}

// ─── Time ──────────────────────────────────────────────────────────────────────

/**
 * Returns a short relative time label from an ISO timestamp.
 * Examples: "just now", "2m ago", "4h ago", "Yesterday", "12 May"
 */
export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// ─── Progress ──────────────────────────────────────────────────────────────────

/**
 * Clamp a value between 0 and 100 for safe progress bar widths.
 */
export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Returns the Tailwind utility class for HP bar color.
 * Below 30% HP: terracotta. Otherwise: muted-emerald.
 */
export function hpBarColor(hp: number): string {
  return hp < 30 ? 'bg-terracotta' : 'bg-muted-emerald';
}

// ─── Strings ───────────────────────────────────────────────────────────────────

/**
 * Lightweight class name merger. Joins truthy strings.
 * Keeps the bundle free of clsx/tailwind-merge for this utility layer.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Returns the first character of a string, uppercased.
 * Used for avatar initials.
 */
export function initial(str: string): string {
  return str.charAt(0).toUpperCase();
}

/**
 * Pluralise a label based on count.
 * pluralise(1, 'day') → '1 day'
 * pluralise(5, 'day') → '5 days'
 */
export function pluralise(count: number, singular: string): string {
  return `${count} ${singular}${count !== 1 ? 's' : ''}`;
}

// ─── Validation ────────────────────────────────────────────────────────────────

/**
 * Parse a user-entered amount string into a positive integer (cents/IDR units).
 * Returns NaN if invalid.
 */
export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10);
}

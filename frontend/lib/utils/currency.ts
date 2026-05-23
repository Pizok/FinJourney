// lib/utils/currency.ts
// Centralized currency formatting utility for FinJourney.
// All monetary display must go through these helpers — never format inline.

export type CurrencyCode = 'IDR' | 'USD' | 'EUR' | 'GBP' | 'SGD' | 'MYR';

interface CurrencyConfig {
  code: CurrencyCode;
  locale: string;
  symbol: string;
  decimalPlaces: number;
}

const CURRENCY_CONFIGS: Record<CurrencyCode, CurrencyConfig> = {
  IDR: { code: 'IDR', locale: 'id-ID', symbol: 'Rp',  decimalPlaces: 0 },
  USD: { code: 'USD', locale: 'en-US', symbol: '$',   decimalPlaces: 2 },
  EUR: { code: 'EUR', locale: 'de-DE', symbol: '€',   decimalPlaces: 2 },
  GBP: { code: 'GBP', locale: 'en-GB', symbol: '£',   decimalPlaces: 2 },
  SGD: { code: 'SGD', locale: 'en-SG', symbol: 'S$',  decimalPlaces: 2 },
  MYR: { code: 'MYR', locale: 'ms-MY', symbol: 'RM',  decimalPlaces: 2 },
};

// Module-level active currency — set once during onboarding, read everywhere.
let _activeCurrency: CurrencyCode = 'IDR';

export function setActiveCurrency(code: CurrencyCode): void {
  _activeCurrency = code;
}

export function getActiveCurrency(): CurrencyCode {
  return _activeCurrency;
}

/**
 * Format a number as a currency string.
 *
 * @example
 *   formatCurrency(1500000)            // "Rp 1.500.000"  (IDR default)
 *   formatCurrency(1500000, 'IDR', { compact: true })  // "Rp 1,5 jt"
 *   formatCurrency(99.5,   'USD')      // "$99.50"
 */
export function formatCurrency(
  amount: number,
  currencyCode?: CurrencyCode,
  options?: { compact?: boolean; showSymbol?: boolean },
): string {
  const config = CURRENCY_CONFIGS[currencyCode ?? _activeCurrency];
  const compact    = options?.compact    ?? false;
  const showSymbol = options?.showSymbol ?? true;

  if (!showSymbol) {
    return new Intl.NumberFormat(config.locale, {
      minimumFractionDigits: config.decimalPlaces,
      maximumFractionDigits: config.decimalPlaces,
    }).format(amount);
  }

  if (compact) {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.code,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }

  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.code,
    minimumFractionDigits: config.decimalPlaces,
    maximumFractionDigits: config.decimalPlaces,
  }).format(amount);
}

/**
 * Parse a user-entered currency string into a plain number.
 * Strips symbols, thousands separators, and whitespace.
 */
export function parseCurrencyInput(value: string): number {
  const cleaned = value
    .replace(/[^\d.,]/g, '')   // keep only digits, dot, comma
    .replace(/\./g, '')        // remove thousands dots (IDR style)
    .replace(',', '.');        // normalise decimal comma to dot
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Sanitise a raw keypress value for a financial input field.
 * Prevents negative signs, letters, and duplicate decimal points.
 */
export function sanitizeCurrencyInput(value: string): string {
  return value
    .replace(/[^0-9.]/g, '')          // digits and period only
    .replace(/(\..*)\./g, '$1');       // allow at most one period
}

/** Derive daily budget using the core formula. */
export function calcDailyBudget(params: {
  monthlyIncome:  number;
  fixedCosts:     number;
  savingsTarget:  number;
}): number {
  return (params.monthlyIncome - params.fixedCosts - params.savingsTarget) / 30;
}

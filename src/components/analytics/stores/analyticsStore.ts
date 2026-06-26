/**
 * components/analytics/stores/analyticsStore.ts
 *
 * Barrel re-export.
 *
 * All analytics components import from '../stores/analyticsStore' (with an "s"),
 * but the canonical store file lives at '../store/analyticsStore' (no "s").
 * This file bridges that discrepancy without requiring mass import rewrites.
 */

export * from '../store/analyticsStore';

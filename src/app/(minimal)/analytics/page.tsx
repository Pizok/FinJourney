// =============================================================================
// app/(minimal)/analytics/page.tsx — FinJourney Analytics Page
//
// Next.js App Router Server Component.
//
// Role:
//   Entry point for the /analytics route. Bootstraps the Zustand store
//   with mock data on mount (identical pattern to wallet/page.tsx) and
//   renders the full analytics layout via AnalyticsShell + the analytics
//   grid sections.
//
// Access Gate:
//   AnalyticsShell reads unlock_status from the store. Users below Level 3
//   see AnalyticsPreview + AnalyticsLockedOverlay instead of live data.
//
// To activate server-side hydration (when API is ready):
//   1. Uncomment the fetch block below.
//   2. Pass initialData to <AnalyticsClientRoot initialData={initialData} />.
// =============================================================================

import type { Metadata } from 'next';
import { AnalyticsClientRoot } from '@/components/analytics/layout/AnalyticsClientRoot';

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Analytics — FinJourney',
  description:
    'Actionable cash flow trends, debt reality checks, spending breakdowns, and your Financial Stability Score.',
  openGraph: {
    title: 'Analytics — FinJourney',
    description: 'Your financial health, clearly mapped.',
  },
};

// ─── Page Component ────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  return <AnalyticsClientRoot />;
}

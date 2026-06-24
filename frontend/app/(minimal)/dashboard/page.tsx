/**
 * app/(minimal)/dashboard/page.tsx
 *
 * Server Component — dashboard route entry point.
 *
 * ─── Fetch Strategy ────────────────────────────────────────────────────────────
 * The real bootstrap fetch is kept here, commented out, ready to activate.
 * Until wired up, DashboardShell renders immediately and the Zustand store
 * falls back to MOCK_BOOTSTRAP so all UI components render with complete data.
 *
 * To activate real data:
 *   1. Uncomment the fetch block below.
 *   2. Pass the `bootstrapData` prop into <DashboardShell />.
 *   3. Call store.setData(bootstrapData) inside a useEffect in DashboardShell
 *      (or pass it directly to the store initialiser).
 * ───────────────────────────────────────────────────────────────────────────────
 */

import type { BootstrapData } from '@/components/dashboard/types/dashboard.types';
import { DashboardShell } from '@/components/dashboard/layout/DashboardShell';
import { apiFetchServer } from '@/lib/apiClient.server';

// ─── Metadata ──────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Dashboard — FinJourney',
  description: 'Your active mission overview.',
};

export default async function DashboardPage() {
  const bootstrapData = await apiFetchServer('me/bootstrap', {
    // Revalidate every 60 seconds; dashboard data changes frequently
    next: { revalidate: 60 }
  }) as BootstrapData | null;

  // UI-testing mode: shell renders with mock data from the Zustand store
  // if bootstrapData is null.
  return <DashboardShell bootstrapData={bootstrapData} />;
}

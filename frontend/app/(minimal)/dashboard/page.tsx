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

// import { cookies } from 'next/headers';
// import { redirect } from 'next/navigation';
// import type { BootstrapData } from '@/components/dashboard/types/dashboard.types';

import { DashboardShell } from '@/components/dashboard/layout/DashboardShell';

// ─── Metadata ──────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Dashboard — FinJourney',
  description: 'Your active mission overview.',
};

// ─── Server-Side Fetch (commented out — activate when API is ready) ─────────────

// async function fetchBootstrap(): Promise<BootstrapData | null> {
//   const cookieStore = await cookies();
//   const accessToken = cookieStore.get('sb-access-token')?.value;
//
//   if (!accessToken) return null;
//
//   try {
//     const res = await fetch(
//       `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/me/bootstrap`,
//       {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           'Content-Type': 'application/json',
//         },
//         // Revalidate every 60 seconds; dashboard data changes frequently
//         next: { revalidate: 60 },
//       }
//     );
//
//     if (!res.ok) return null;
//
//     const json = await res.json();
//     return json.success ? (json.data as BootstrapData) : null;
//   } catch {
//     return null;
//   }
// }

// ─── Page Component ────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  // ── Activate this block once the API is ready ──────────────────────────────
  //
  // const bootstrapData = await fetchBootstrap();
  //
  // if (!bootstrapData) {
  //   // No valid session — redirect to login
  //   redirect('/login');
  // }
  //
  // ── Pass real data into the shell:
  // return <DashboardShell bootstrapData={bootstrapData} />;
  // ──────────────────────────────────────────────────────────────────────────

  // UI-testing mode: shell renders with mock data from the Zustand store.
  return <DashboardShell />;
}

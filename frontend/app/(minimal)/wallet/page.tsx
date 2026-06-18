// =============================================================================
// app/(minimal)/wallet/page.tsx — FinJourney Wallet Page
//
// Next.js App Router Server Component.
//
// Role of this file:
//   This is the entry point. It is a React Server Component (no "use client").
//   Its only job is to optionally fetch initial data on the server, then
//   pass it to <WalletShell /> — the Client Component that owns all
//   interactivity, Zustand state, and child rendering.
//
// Why server-side fetch?
//   Fetching on the server eliminates the blank-then-skeleton flash that
//   occurs when data is fetched client-side. The user receives a fully-
//   populated page on first load rather than waiting for a client round-trip.
//
// Current state (Part 1 — Foundation):
//   The real fetch is drafted but commented out. <WalletShell /> receives no
//   initialData prop and falls back to MOCK_WALLET_BOOTSTRAP automatically.
//
// To activate server-side hydration (Part 2):
//   1. Uncomment the fetch block.
//   2. Add initialData to <WalletShell initialData={initialData} />.
//   3. In WalletShell, call hydrate(initialData) instead of hydrateMock()
//      when initialData is not null.
// =============================================================================

import type { Metadata } from 'next';
// import { redirect }      from 'next/navigation';
// import { cookies }       from 'next/headers';
// import type { WalletBootstrapResponse } from '@/types/wallet.types';
import { WalletShell } from '@/components/wallet/layout/WalletShell';

// ─────────────────────────────────────────────────────────────────────────────
// Metadata
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Wallet — FinJourney',
  description:
    'View your liquid balances, track spending limits, and manage your full transaction history.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────

export default async function WalletPage() {

  // ===========================================================================
  // SERVER-SIDE BOOTSTRAP FETCH — COMMENTED OUT (Part 1)
  //
  // Uncomment this entire block when:
  //   (a) The real API endpoint is deployed and reachable from the server.
  //   (b) WalletShell has been updated to accept an `initialData` prop.
  //
  // Implementation notes:
  //   • Uses Next.js cookies() to forward the Supabase JWT so the API can
  //     validate the session server-side.
  //   • `cache: 'no-store'` is mandatory for financial data — we never want
  //     stale balances from the Next.js fetch cache.
  //   • Errors are caught gracefully. WalletShell handles empty/error UI.
  //   • The `redirect()` call guards against reaching this page unauthenticated.
  //     In production, middleware should handle this before we get here.
  // ===========================================================================

  // let initialData: WalletBootstrapResponse | null = null;
  //
  // try {
  //   const cookieStore = await cookies();
  //   const token = cookieStore.get('sb-access-token')?.value;
  //
  //   if (!token) {
  //     // Auth middleware should catch this first, but guard defensively.
  //     redirect('/auth/login');
  //   }
  //
  //   const baseUrl =
  //     process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
  //
  //   const response = await fetch(`${baseUrl}/api/v1/wallet/bootstrap`, {
  //     method: 'GET',
  //     headers: {
  //       'Content-Type':  'application/json',
  //       'Authorization': `Bearer ${token}`,
  //     },
  //     // Financial data must never be served stale.
  //     cache: 'no-store',
  //   });
  //
  //   if (!response.ok) {
  //     // Log for server-side observability (e.g. Sentry / Datadog).
  //     // The UI error state handles user-facing feedback.
  //     console.error(
  //       `[WalletPage] Bootstrap ${response.status} ${response.statusText}`,
  //     );
  //   } else {
  //     const json = await response.json();
  //
  //     // Validate the standard API success envelope.
  //     if (json?.success === true && json?.data) {
  //       initialData = json.data as WalletBootstrapResponse;
  //     } else {
  //       console.error('[WalletPage] Unexpected bootstrap shape:', json);
  //     }
  //   }
  // } catch (err) {
  //   // Network failure, DNS error, or JSON parse failure.
  //   // WalletShell renders a retry affordance for the user.
  //   console.error('[WalletPage] Bootstrap threw:', err);
  // }

  // ===========================================================================
  // RENDER
  //
  // Part 1: no initialData prop — WalletShell falls back to hydrateMock().
  //
  // Part 2 (after uncommenting above):
  //   return <WalletShell initialData={initialData} />;
  // ===========================================================================

  return <WalletShell />;
}

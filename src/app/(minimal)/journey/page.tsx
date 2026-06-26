// =============================================================================
// app/(minimal)/journey/page.tsx
//
// Next.js App Router — Server Component
//
// Role:
//   - Provides page-level metadata
//   - Defines the responsive layout shell (single-column mobile → constrained
//     desktop column with section-to-section breathing room)
//   - Delegates ALL data fetching and interactivity to the client boundary
//     (JourneyPageClient), keeping this file side-effect-free and cacheable.
//
// Layout philosophy ("The Clear Night Journey"):
//   - Single vertical scroll axis — the Journey page is exploratory, not
//     a daily utility dashboard. Users scroll to review their history.
//   - Max-width 920px centred — preserves comfortable reading widths on
//     wide monitors without creating an enterprise spreadsheet feel.
//   - gap-8 (32px) between major sections — spacious AAA-style breathing room.
//   - Mobile: same single-column layout, narrower gutters (px-5).
//
// Server Component constraints:
//   - No "use client" directive here.
//   - Do NOT import Zustand, TanStack Query hooks, or browser-only APIs.
//   - All interactive children are imported from the client boundary below.
// =============================================================================

import type { Metadata } from "next";
import { JourneyPageClient } from "@/components/journey/layout/JourneyPageClient";
import { DashboardSidebar } from "@/components/dashboard/layout/DashboardSidebar";

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "The Journey | FinJourney",
  description:
    "Track your long-term financial progression, quarterly reviews, regional milestones, and passport stamps.",
  openGraph: {
    title: "The Journey | FinJourney",
    description: "Your financial story, mapped over time.",
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JourneyPage() {
  return (
    <div className="flex min-h-screen bg-abyssal-slate">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1440px] mx-auto px-8 py-8">
          <JourneyPageClient />
        </div>
      </main>
    </div>
  );
}

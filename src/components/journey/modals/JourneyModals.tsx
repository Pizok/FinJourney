"use client";

// =============================================================================
// features/journey/modals/JourneyModals.tsx
//
// Modal portal coordinator for the Journey page.
//
// Reads `activeModal` from the Zustand store and renders the correct modal
// component based on `activeModal.kind`. Each modal delegates to Modal.tsx
// which internally uses ReactDOM.createPortal(…, document.body), so all
// modals render above the dashboard layout's z-stack regardless of where
// JourneyModals is placed in the component tree.
//
// Supported kinds (ModalPayload discriminated union):
//   "region"  → RegionDetailModal  (fetches GET /api/v1/journey/regions/:id)
//   "review"  → ReviewDetailModal  (fetches GET /api/v1/journey/reviews/:id)
//   "stamp"   → PassportDetailModal (no fetch — stamp is fully loaded)
//   null      → nothing rendered
//
// Rendered by JourneyPageClient — drop-in replacement for the placeholder
// comment at the bottom of the section stack.
//
// Usage:
//   import { JourneyModals } from "./modals/JourneyModals";
//   // Inside JourneyPageClient's return:
//   <JourneyModals />
// =============================================================================

import { useActiveModal, useModalActions } from "@/components/journey/stores/journeyStore";
import { RegionDetailModal } from "./RegionDetailModal";
import { ReviewDetailModal } from "./ReviewDetailModal";
import { ReportDetailModal } from "./ReportDetailModal";
import { PassportDetailModal } from "./PassportDetailModal";
import { HistoryModal } from "./HistoryModal";
import { AllStampsModal } from "./AllStampsModal";

export function JourneyModals() {
  const activeModal = useActiveModal();
  const { closeModal } = useModalActions();

  // No modal active — render nothing (Modal.tsx handles its own portal
  // so we don't need a null portal here)
  if (activeModal === null) return null;

  switch (activeModal.kind) {
    // ── Region detail ──────────────────────────────────────────────────
    case "region":
      return (
        <RegionDetailModal
          isOpen
          onClose={closeModal}
          regionId={activeModal.regionId}
          summary={activeModal.summary}
        />
      );

    // ── Review detail ──────────────────────────────────────────────────
    case "review":
      return (
        <ReviewDetailModal
          isOpen
          onClose={closeModal}
          reviewId={activeModal.reviewId}
          summary={activeModal.summary}
        />
      );

    // ── Report detail ──────────────────────────────────────────────────
    case "report":
      return (
        <ReportDetailModal
          isOpen
          onClose={closeModal}
          report={activeModal.report}
        />
      );

    // ── Passport stamp detail ──────────────────────────────────────────
    case "stamp":
      return (
        <PassportDetailModal
          isOpen
          onClose={closeModal}
          stamp={activeModal.stamp}
        />
      );

    // ── History modal ──────────────────────────────────────────────────
    case "history":
      return (
        <HistoryModal
          isOpen
          onClose={closeModal}
        />
      );

    // ── All Stamps ─────────────────────────────────────────────────────
    case "all_stamps":
      return (
        <AllStampsModal
          isOpen
          onClose={closeModal}
          stamps={activeModal.stamps}
          locked={activeModal.locked}
        />
      );

    // ── Exhaustive guard ───────────────────────────────────────────────
    // TypeScript will warn here if a new ModalPayload kind is added to
    // the union without a corresponding case.
    default: {
      const _exhaustive: never = activeModal;
      console.warn("JourneyModals: unhandled modal kind", _exhaustive);
      return null;
    }
  }
}

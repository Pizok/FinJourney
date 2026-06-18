'use client';

import { DashboardSidebar } from './DashboardSidebar';
import { DashboardGrid } from './DashboardGrid';
import { WelcomeModal } from '../modals/WelcomeModal';
import { TutorialModal } from '../modals/TutorialModal';
import { DangerModal } from '../modals/DangerModal';
import { AddTransactionModal } from '../modals/AddTransactionModal';
import { NotificationModal } from '../modals/NotificationModal';
import { useDashboardModals } from '../hooks/useDashboardModals';

// ─── Modal Layer ───────────────────────────────────────────────────────────────

/**
 * Renders one blocking modal at a time, resolved by priority order.
 * Only a single overlay is present in the DOM at any moment.
 */
function ModalLayer() {
  const { currentModal, closeModal } = useDashboardModals();

  if (!currentModal) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-abyssal-slate/80"
        aria-hidden="true"
        onClick={closeModal}
      />

      {/* Active Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        {currentModal === 'welcome' && (
          <WelcomeModal onClose={closeModal} />
        )}
        {currentModal === 'tutorial' && (
          <TutorialModal onClose={closeModal} />
        )}
        {currentModal === 'danger' && (
          <DangerModal onClose={closeModal} />
        )}
        {currentModal === 'addTransaction' && (
          <AddTransactionModal onClose={closeModal} />
        )}
        {currentModal === 'notification' && (
          <NotificationModal onClose={closeModal} />
        )}
      </div>
    </>
  );
}

// ─── Shell ─────────────────────────────────────────────────────────────────────

/**
 * Client root for the dashboard route.
 *
 * page.tsx (Server Component) renders this shell unconditionally.
 * The Zustand store initialises with mock data, so all child components
 * render immediately without waiting for any async fetch.
 */
export function DashboardShell() {
  return (
    <div className="flex min-h-screen bg-abyssal-slate">
      {/* Sidebar */}
      <DashboardSidebar />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1440px] mx-auto px-8 py-8">
          {/* Page header */}
          <header className="mb-8">
            <h1 className="font-display text-xl font-semibold text-pearl-text">
              Dashboard
            </h1>
            <p className="font-sans text-sm text-muted-text mt-1">
              Your active mission overview.
            </p>
          </header>

          {/* Card grid */}
          <DashboardGrid />
        </div>
      </main>

      {/* Modal layer — exactly one modal rendered at a time */}
      <ModalLayer />
    </div>
  );
}

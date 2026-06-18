'use client';

import { useDashboardStore } from '../stores/dashboardStore';
import { useDashboardData } from './useDashboardData';
import type { ModalType } from '../types/dashboard.types';

interface UseDashboardModalsReturn {
  /** The modal that should currently be rendered (priority-resolved). */
  currentModal: ModalType;
  openModal: (modal: Exclude<ModalType, null>) => void;
  closeModal: () => void;
  openAddTransaction: () => void;
}

/**
 * Resolves the currently active modal using the following priority:
 *
 *   1. welcome      — player has never completed onboarding
 *   2. tutorial     — baseline has not been set
 *   3. danger       — ghost penalty is active (no activity 3+ days)
 *   4. notification — pending system notification (not yet implemented)
 *   5. addTransaction — user-triggered, lowest priority
 *
 * An explicit user action (openModal / closeModal) always takes precedence
 * over the auto-resolved priority while active.
 */
export function useDashboardModals(): UseDashboardModalsReturn {
  const activeModal = useDashboardStore((s) => s.activeModal);
  const openModal = useDashboardStore((s) => s.openModal);
  const closeModal = useDashboardStore((s) => s.closeModal);
  const { data } = useDashboardData();

  function resolveAutoModal(): ModalType {
    const { profile, daily_status } = data;

    if (profile.setup_status === 'onboarding') return 'welcome';
    if (!daily_status.baseline_set) return 'tutorial';
    if (daily_status.ghost_penalty_active) return 'danger';
    return null;
  }

  // User-triggered modal wins; fall back to auto-resolution.
  const currentModal: ModalType = activeModal ?? resolveAutoModal();

  return {
    currentModal,
    openModal,
    closeModal,
    openAddTransaction: () => openModal('addTransaction'),
  };
}

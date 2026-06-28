'use client';

import { create } from 'zustand';
import type { ModalType } from '../types/dashboard.types';

// ─── Store Shape ────────────────────────────────────────────────────────────────

interface DashboardStore {
  // UI
  activeModal: ModalType;

  // Modal actions
  openModal: (modal: Exclude<ModalType, null>) => void;
  closeModal: () => void;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useDashboardStore = create<DashboardStore>()((set) => ({
  activeModal: null,

  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
}));

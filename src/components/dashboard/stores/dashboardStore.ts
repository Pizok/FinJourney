'use client';

import { create } from 'zustand';
import type {
  BootstrapData,
  ModalType,
  Transaction,
} from '../types/dashboard.types';

// ─── Store Shape ────────────────────────────────────────────────────────────────

interface DashboardStore {
  // Data
  data: BootstrapData | null;
  isLoading: boolean;
  error: string | null;

  // UI
  activeModal: ModalType;

  // Data actions
  setData: (data: BootstrapData) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Modal actions
  openModal: (modal: Exclude<ModalType, null>) => void;
  closeModal: () => void;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useDashboardStore = create<DashboardStore>()((set) => ({
  data: null,
  isLoading: true,
  error: null,
  activeModal: null,

  setData: (data) => set({ data }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
}));

'use client';

import { useDashboardStore } from '../stores/dashboardStore';
import type { BootstrapData } from '../types/dashboard.types';

interface UseDashboardDataReturn {
  data: BootstrapData;
  isLoading: boolean;
  error: string | null;
}

/**
 * Primary data hook for all dashboard child components.
 * Always returns the mock data during UI testing; swap setData() in page.tsx
 * once the real bootstrap fetch is wired up.
 */
export function useDashboardData(): UseDashboardDataReturn {
  const data = useDashboardStore((s) => s.data);
  const isLoading = useDashboardStore((s) => s.isLoading);
  const error = useDashboardStore((s) => s.error);

  return { data: data as BootstrapData, isLoading, error };
}

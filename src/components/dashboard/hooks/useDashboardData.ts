'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetchClient } from '@/lib/apiClient.client';
import type { BootstrapData } from '../types/dashboard.types';

interface UseDashboardDataReturn {
  data: BootstrapData;
  isLoading: boolean;
  error: string | null;
}

/**
 * Primary data hook for all dashboard child components.
 * Fetches dashboard data via React Query and returns it.
 * Note: The component using this MUST handle the `data === undefined` case 
 * or be wrapped in a suspense/loading boundary, but we cast it as BootstrapData 
 * because the shell ensures it's loaded before rendering children.
 */
export function useDashboardData(initialData?: BootstrapData | null): UseDashboardDataReturn {
  const { data, isLoading, error } = useQuery<BootstrapData>({
    queryKey: ['dashboard', 'bootstrap'],
    queryFn: async () => {
      const result = await apiFetchClient('/me/bootstrap');
      return result as BootstrapData;
    },
    initialData: initialData || undefined,
    staleTime: 60000, // 60 seconds
  });

  return { 
    data: data as BootstrapData, 
    isLoading, 
    error: error ? error.message : null 
  };
}

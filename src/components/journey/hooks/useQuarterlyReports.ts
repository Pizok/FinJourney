import { useQuery } from '@tanstack/react-query';
import { JOURNEY_QUERY_KEYS } from '../types/journey.types';
import type { QuarterlyReportListItem } from '../types/journey.types';
import { apiFetchClient } from '@/lib/apiClient.client';

export function useQuarterlyReports() {
  return useQuery<QuarterlyReportListItem[]>({
    queryKey: ['journey', 'reports'],
    queryFn: async () => {
      const data = await apiFetchClient<{ items: QuarterlyReportListItem[] }>(
        "journey/reviews"
      );
      return data.items;
    },
    staleTime: 5 * 60_000,
  });
}

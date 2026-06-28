import { useQuery } from '@tanstack/react-query';
import type { QuarterlyReportSummary } from '@/components/journey/types/journey.types';
import { apiFetchClient } from '@/lib/apiClient.client';

export function useQuarterlyReportSummary(year: number, quarter: number, enabled: boolean = true) {
  return useQuery<QuarterlyReportSummary>({
    queryKey: ['journey', 'report_summary', year, quarter],
    queryFn: async () => {
      const data = await apiFetchClient<{ summary: QuarterlyReportSummary }>(
        `journey/reviews/${year}/${quarter}/summary`
      );
      return data.summary;
    },
    staleTime: 5 * 60_000,
    enabled: enabled && !!year && !!quarter,
  });
}

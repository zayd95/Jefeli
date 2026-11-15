import { useQuery } from '@tanstack/react-query';

import { fetchFeatureFlags } from './api/safety';

export function useFeatureFlags() {
  const q = useQuery({ queryKey: ['feature-flags'], queryFn: fetchFeatureFlags, staleTime: 5 * 60_000 });
  return q.data ?? {};
}

export function useFlag(key: string): boolean {
  return useFeatureFlags()[key] === true;
}

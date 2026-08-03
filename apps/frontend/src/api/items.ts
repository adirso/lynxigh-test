import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { Item, ItemStatus } from '../types/models';

export type ItemFilters = {
  categoryId?: string;
  condition?: string;
  search?: string;
  status?: ItemStatus;
};

function buildQuery(filters: ItemFilters): string {
  const params = new URLSearchParams();
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  if (filters.condition) params.set('condition', filters.condition);
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useItems(filters: ItemFilters) {
  return useQuery({
    queryKey: ['items', filters],
    queryFn: () => apiClient<Item[]>(`/items${buildQuery(filters)}`),
  });
}

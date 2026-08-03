import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { Category } from '../types/models';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient<Category[]>('/categories'),
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { Item } from '../types/models';

export function useModerationQueue() {
  return useQuery({
    queryKey: ['moderation', 'queue'],
    queryFn: () => apiClient<Item[]>('/moderation/queue'),
  });
}

export function useApproveItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient<Item>(`/items/${id}/approve`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation', 'queue'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

export function useRejectItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient<Item>(`/items/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation', 'queue'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

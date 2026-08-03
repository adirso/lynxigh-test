import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { Item, ItemStatus } from '../types/models';
import type { ItemFormValues } from '../components/ItemForm';

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

export function useItem(id: string) {
  return useQuery({
    queryKey: ['items', 'detail', id],
    queryFn: () => apiClient<Item>(`/items/${id}`),
    enabled: !!id,
  });
}

function toFormData(values: ItemFormValues): FormData {
  const formData = new FormData();
  formData.set('title', values.title);
  formData.set('description', values.description);
  formData.set('price', String(values.price));
  formData.set('condition', values.condition);
  formData.set('isNegotiable', String(values.isNegotiable));
  if (values.isNegotiable && values.minPrice != null) formData.set('minPrice', String(values.minPrice));
  formData.set('categoryId', values.categoryId);
  formData.set('options', JSON.stringify(values.options));
  values.photos.forEach((p) => formData.append('photos', p.file));
  return formData;
}

export function createItem(values: ItemFormValues) {
  return apiClient<Item>('/items', { method: 'POST', body: toFormData(values) });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });
}

export function useMyItems() {
  return useQuery({
    queryKey: ['items', 'mine'],
    queryFn: () => apiClient<Item[]>('/items/mine'),
  });
}

type UpdateItemInput = {
  title: string;
  description: string;
  price: number;
  condition: string;
  isNegotiable: boolean;
  minPrice?: number;
  categoryId: string;
  options: string[];
};

export function updateItem(id: string, values: UpdateItemInput) {
  return apiClient<Item>(`/items/${id}`, { method: 'PUT', body: JSON.stringify(values) });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: UpdateItemInput }) => updateItem(id, values),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['items', 'detail', variables.id] });
    },
  });
}

export function deleteItem(id: string) {
  return apiClient<void>(`/items/${id}`, { method: 'DELETE' });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });
}

export function cancelItem(id: string) {
  return apiClient<Item>(`/items/${id}/cancel`, { method: 'PATCH' });
}

export function useCancelItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

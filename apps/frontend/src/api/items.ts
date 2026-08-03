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

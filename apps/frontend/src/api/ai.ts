import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { PickedPhoto } from '../components/PhotoPicker';

const MAX_PHOTOS_FOR_GENERATION = 4;

export type GenerateDescriptionValues = {
  title: string;
  categoryId: string;
  condition: string;
  options: string[];
  photos: PickedPhoto[];
};

export function useAiAvailability(enabled: boolean) {
  return useQuery({
    queryKey: ['ai', 'status'],
    queryFn: () => apiClient<{ available: boolean }>('/ai/status'),
    enabled,
  });
}

function toFormData(values: GenerateDescriptionValues): FormData {
  const formData = new FormData();
  formData.set('title', values.title);
  if (values.categoryId) formData.set('categoryId', values.categoryId);
  formData.set('condition', values.condition);
  formData.set('options', JSON.stringify(values.options));
  values.photos.slice(0, MAX_PHOTOS_FOR_GENERATION).forEach((p) => formData.append('photos', p.file));
  return formData;
}

export function useGenerateDescription() {
  return useMutation({
    mutationFn: (values: GenerateDescriptionValues) =>
      apiClient<{ description: string }>('/ai/generate-description', { method: 'POST', body: toFormData(values) }),
  });
}

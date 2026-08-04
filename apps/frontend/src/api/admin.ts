import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { AuditLogEntry } from '../types/models';

export function useAuditLog() {
  return useQuery({
    queryKey: ['admin', 'audit-log'],
    queryFn: () => apiClient<AuditLogEntry[]>('/admin/audit-log'),
  });
}

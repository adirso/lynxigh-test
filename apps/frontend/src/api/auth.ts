import { apiClient } from '../lib/api-client';
import type { User } from '../types/models';

export type AuthResponse = { token: string; user: User };

export function registerRequest(input: { email: string; password: string; name: string }) {
  return apiClient<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
    skipAuthRedirect: true,
  });
}

export function loginRequest(input: { email: string; password: string }) {
  return apiClient<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
    skipAuthRedirect: true,
  });
}

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

// skipAuthRedirect: this call validates a session we're not sure is still
// good. A failure here should quietly log the user out, not force-redirect
// them off whatever page they're on — they might just be an anonymous
// visitor with a stale token, browsing a public page.
export function getCurrentUserRequest() {
  return apiClient<User>('/auth/me', { skipAuthRedirect: true });
}

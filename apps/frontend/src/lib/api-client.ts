const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const TOKEN_KEY = 'reloop_token';
const USER_KEY = 'reloop_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Clears both the token and the persisted user, e.g. on a forced logout (401) or explicit logout. */
export function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

type ApiClientOptions = RequestInit & { skipAuthRedirect?: boolean };

export async function apiClient<T>(path: string, options: ApiClientOptions = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const isFormData = options.body instanceof FormData;
  if (!isFormData && options.body) headers.set('Content-Type', 'application/json');

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && !options.skipAuthRedirect) {
    clearStoredSession();
    window.location.assign('/login');
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error?.message ?? 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export { API_URL, USER_KEY };

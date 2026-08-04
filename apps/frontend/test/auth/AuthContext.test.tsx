import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../msw/server';
import { API_URL } from '../msw/handlers';
import { renderWithProviders } from '../test-utils';
import { useAuth } from '../../src/auth/useAuth';

function AuthProbe() {
  const { user } = useAuth();
  return <div data-testid="auth-probe">{user ? `${user.name} (${user.role})` : 'anonymous'}</div>;
}

function seedSession(user: { id: string; email: string; name: string; role: 'CONTRIBUTOR' | 'MODERATOR' }) {
  localStorage.setItem('reloop_token', 'tok-1');
  localStorage.setItem('reloop_user', JSON.stringify(user));
}

describe('AuthContext session validation', () => {
  it('refreshes the cached user with the server response on mount', async () => {
    seedSession({ id: 'u1', email: 'jordan@example.com', name: 'Stale Name', role: 'CONTRIBUTOR' });
    server.use(
      http.get(`${API_URL}/auth/me`, () =>
        HttpResponse.json({ id: 'u1', email: 'jordan@example.com', name: 'Fresh Name', role: 'CONTRIBUTOR' }),
      ),
    );

    renderWithProviders(<AuthProbe />);

    // Optimistic initial render uses the stale cached value...
    expect(screen.getByTestId('auth-probe')).toHaveTextContent('Stale Name (CONTRIBUTOR)');
    // ...then updates once /auth/me resolves.
    await waitFor(() => {
      expect(screen.getByTestId('auth-probe')).toHaveTextContent('Fresh Name (CONTRIBUTOR)');
    });
    expect(JSON.parse(localStorage.getItem('reloop_user')!).name).toBe('Fresh Name');
  });

  it('logs out quietly (no redirect) when the session no longer validates', async () => {
    seedSession({ id: 'u2', email: 'gone@example.com', name: 'Gone User', role: 'CONTRIBUTOR' });
    server.use(
      http.get(`${API_URL}/auth/me`, () =>
        HttpResponse.json({ error: { message: 'User no longer exists' } }, { status: 401 }),
      ),
    );

    renderWithProviders(<AuthProbe />);

    expect(screen.getByTestId('auth-probe')).toHaveTextContent('Gone User');

    await waitFor(() => {
      expect(screen.getByTestId('auth-probe')).toHaveTextContent('anonymous');
    });
    expect(localStorage.getItem('reloop_token')).toBeNull();
    expect(localStorage.getItem('reloop_user')).toBeNull();
  });

  it('does nothing on mount when there is no stored session', async () => {
    renderWithProviders(<AuthProbe />);
    expect(screen.getByTestId('auth-probe')).toHaveTextContent('anonymous');
  });
});

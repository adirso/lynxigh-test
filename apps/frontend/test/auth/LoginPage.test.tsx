import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../msw/server';
import { API_URL } from '../msw/handlers';
import { renderWithProviders } from '../test-utils';
import LoginPage from '../../src/pages/LoginPage';

describe('LoginPage', () => {
  it('logs in and stores the session on success', async () => {
    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json({
          token: 'tok-2',
          user: { id: 'u2', email: 'morgan@example.com', name: 'Morgan', role: 'MODERATOR' },
        }),
      ),
    );

    renderWithProviders(<LoginPage />, { route: '/login' });

    await userEvent.type(screen.getByLabelText(/email/i), 'morgan@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'super-secret-1');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(localStorage.getItem('reloop_token')).toBe('tok-2');
    });
  });

  it('shows an error on invalid credentials (401)', async () => {
    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json({ error: { message: 'Invalid email or password' } }, { status: 401 }),
      ),
    );

    renderWithProviders(<LoginPage />, { route: '/login' });

    await userEvent.type(screen.getByLabelText(/email/i), 'morgan@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });
});

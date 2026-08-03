import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../msw/server';
import { API_URL } from '../msw/handlers';
import { renderWithProviders } from '../test-utils';
import SignupPage from '../../src/pages/SignupPage';

describe('SignupPage', () => {
  it('registers and redirects home on success', async () => {
    server.use(
      http.post(`${API_URL}/auth/register`, async ({ request }) => {
        const body = (await request.json()) as { email: string; name: string };
        return HttpResponse.json(
          { token: 'tok-1', user: { id: 'u1', email: body.email, name: body.name, role: 'CONTRIBUTOR' } },
          { status: 201 },
        );
      }),
    );

    renderWithProviders(<SignupPage />, { route: '/signup' });

    await userEvent.type(screen.getByLabelText(/name/i), 'Jordan');
    await userEvent.type(screen.getByLabelText(/email/i), 'jordan@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'super-secret-1');
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(localStorage.getItem('reloop_token')).toBe('tok-1');
    });
  });

  it('shows an error message on a duplicate email (409)', async () => {
    server.use(
      http.post(`${API_URL}/auth/register`, () =>
        HttpResponse.json({ error: { message: 'An account with this email already exists' } }, { status: 409 }),
      ),
    );

    renderWithProviders(<SignupPage />, { route: '/signup' });

    await userEvent.type(screen.getByLabelText(/name/i), 'Jordan');
    await userEvent.type(screen.getByLabelText(/email/i), 'dup@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'super-secret-1');
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }));

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });
});

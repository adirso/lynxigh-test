import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from './msw/server';
import { API_URL } from './msw/handlers';
import { AuthProvider } from '../src/auth/AuthContext';
import App from '../src/App';

describe('App', () => {
  it('renders the app shell', async () => {
    server.use(http.get(`${API_URL}/items`, () => HttpResponse.json([])));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('link', { name: /reloop/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /catalog/i })).toBeInTheDocument();
  });
});

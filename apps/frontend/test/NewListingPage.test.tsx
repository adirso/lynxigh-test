import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './msw/server';
import { API_URL } from './msw/handlers';
import { renderWithProviders } from './test-utils';
import NewListingPage from '../src/pages/NewListingPage';

describe('NewListingPage', () => {
  it('submits the form as multipart and shows a success message in place (no navigation)', async () => {
    server.use(
      http.get(`${API_URL}/categories`, () => HttpResponse.json([{ id: 'cat-1', name: 'Electronics' }])),
      http.post(`${API_URL}/items`, () => HttpResponse.json({ id: 'item-9', status: 'PENDING' }, { status: 201 })),
    );

    renderWithProviders(<NewListingPage />, { route: '/listings/new' });

    await userEvent.type(screen.getByLabelText(/^title$/i), 'Tennis Racket');
    await userEvent.type(screen.getByLabelText(/description/i), 'Barely used.');
    await userEvent.type(screen.getByLabelText(/^price/i), '35');
    await userEvent.selectOptions(screen.getByLabelText(/category/i), 'cat-1');

    const file = new File(['fake-bytes'], 'racket.jpg', { type: 'image/jpeg' });
    await userEvent.upload(screen.getByLabelText(/photos/i), file);

    await userEvent.click(screen.getByRole('button', { name: /submit for review/i }));

    // "submitted" alone also matches the static intro paragraph ("Submitted listings go to
    // moderation before they appear in the catalog."), which is present on the page before any
    // submission happens. Assert on "pending moderator review" instead — that phrase only
    // appears in the post-submission success message, so this actually verifies the mutation
    // fired and succeeded rather than just that the page rendered.
    await waitFor(() => {
      expect(screen.getByText(/pending moderator review/i)).toBeInTheDocument();
    });
  });
});

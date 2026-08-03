import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './msw/server';
import { API_URL } from './msw/handlers';
import { renderWithProviders } from './test-utils';
import ModerationPage from '../src/pages/ModerationPage';

const QUEUE = [
  { id: 'item-1', title: 'Canon EF 50mm Lens', price: 120, condition: 'Good', categoryId: 'cat-1', photos: [] },
];

describe('ModerationPage', () => {
  it('renders the pending queue and approves an item', async () => {
    // GET /moderation/queue must be stateful here: approving invalidates and refetches this
    // query, and the real backend would no longer return a PUBLISHED item as pending. A static
    // handler would keep returning item-1, making the "removed from the queue" assertion below
    // impossible to satisfy regardless of what the page does.
    let queue = [...QUEUE];
    server.use(
      http.get(`${API_URL}/moderation/queue`, () => HttpResponse.json(queue)),
      http.get(`${API_URL}/items`, () => HttpResponse.json([])),
      http.post(`${API_URL}/items/item-1/approve`, () => {
        queue = queue.filter((item) => item.id !== 'item-1');
        return HttpResponse.json({ ...QUEUE[0], status: 'PUBLISHED' });
      }),
    );

    renderWithProviders(<ModerationPage />);

    const row = (await screen.findByText('Canon EF 50mm Lens')).closest('tr')!;
    // The approve/reject buttons are icon-only (their visible text is the ✓/✕ glyph, which is
    // also their accessible name — the `title` attribute only supplies a tooltip and does not
    // override an accessible name derived from text content). Target them by title instead of
    // by accessible name.
    await userEvent.click(within(row).getByTitle(/approve/i));

    await waitFor(() => {
      expect(screen.queryByText('Canon EF 50mm Lens')).not.toBeInTheDocument();
    });
  });

  it('rejects an item with a reason', async () => {
    let rejectedBody: unknown;
    server.use(
      http.get(`${API_URL}/moderation/queue`, () => HttpResponse.json(QUEUE)),
      http.get(`${API_URL}/items`, () => HttpResponse.json([])),
      http.post(`${API_URL}/items/item-1/reject`, async ({ request }) => {
        rejectedBody = await request.json();
        return HttpResponse.json({ ...QUEUE[0], status: 'REJECTED' });
      }),
    );

    renderWithProviders(<ModerationPage />);
    const row = (await screen.findByText('Canon EF 50mm Lens')).closest('tr')!;
    await userEvent.click(within(row).getByTitle(/reject/i));
    await userEvent.type(screen.getByLabelText(/reason/i), 'Photos too blurry');
    await userEvent.click(screen.getByRole('button', { name: /confirm reject/i }));

    await waitFor(() => {
      expect(rejectedBody).toEqual({ reason: 'Photos too blurry' });
    });
  });
});

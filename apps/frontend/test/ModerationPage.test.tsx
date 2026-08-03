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
    // The approve/reject buttons are icon-only (visible text is the ✓/✕ glyph). An `aria-label`
    // gives them a real accessible name ("Approve"/"Reject") independent of that glyph and of the
    // `title` tooltip, so this can target them by role + accessible name.
    await userEvent.click(within(row).getByRole('button', { name: /approve/i }));

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
    await userEvent.click(within(row).getByRole('button', { name: /reject/i }));
    await userEvent.type(screen.getByLabelText(/reason/i), 'Photos too blurry');
    await userEvent.click(screen.getByRole('button', { name: /confirm reject/i }));

    await waitFor(() => {
      expect(rejectedBody).toEqual({ reason: 'Photos too blurry' });
    });
  });

  it('blocks a reject submission when the reason is empty or whitespace-only', async () => {
    let rejectCalled = false;
    server.use(
      http.get(`${API_URL}/moderation/queue`, () => HttpResponse.json(QUEUE)),
      http.get(`${API_URL}/items`, () => HttpResponse.json([])),
      http.post(`${API_URL}/items/item-1/reject`, () => {
        rejectCalled = true;
        return HttpResponse.json({ ...QUEUE[0], status: 'REJECTED' });
      }),
    );

    renderWithProviders(<ModerationPage />);
    const row = (await screen.findByText('Canon EF 50mm Lens')).closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: /reject/i }));

    const confirmButton = screen.getByRole('button', { name: /confirm reject/i });
    expect(confirmButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/reason/i), '   ');
    expect(confirmButton).toBeDisabled();

    // A disabled button ignores clicks, but assert directly on the network call too so this
    // test still catches a regression if the disabled guard is ever removed without the
    // underlying handler being fixed to no-op on an empty reason.
    await userEvent.click(confirmButton);
    expect(rejectCalled).toBe(false);
  });

  it('shows a visible error message when the reject request fails, instead of failing silently', async () => {
    server.use(
      http.get(`${API_URL}/moderation/queue`, () => HttpResponse.json(QUEUE)),
      http.get(`${API_URL}/items`, () => HttpResponse.json([])),
      http.post(`${API_URL}/items/item-1/reject`, () =>
        HttpResponse.json({ error: { message: 'Reason required' } }, { status: 400 }),
      ),
    );

    renderWithProviders(<ModerationPage />);
    const row = (await screen.findByText('Canon EF 50mm Lens')).closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: /reject/i }));
    await userEvent.type(screen.getByLabelText(/reason/i), 'Photos too blurry');
    await userEvent.click(screen.getByRole('button', { name: /confirm reject/i }));

    expect(await screen.findByText('Reason required')).toBeInTheDocument();
  });

  it('requests a large pageSize for the Published/Rejected stat counts so they are not capped at the default 24', async () => {
    const requestedUrls: string[] = [];
    server.use(
      http.get(`${API_URL}/moderation/queue`, () => HttpResponse.json([])),
      http.get(`${API_URL}/items`, ({ request }) => {
        requestedUrls.push(request.url);
        return HttpResponse.json([]);
      }),
    );

    renderWithProviders(<ModerationPage />);
    await screen.findByText('Pending review');

    await waitFor(() => {
      expect(requestedUrls.some((url) => url.includes('status=PUBLISHED') && url.includes('pageSize=100'))).toBe(
        true,
      );
      expect(requestedUrls.some((url) => url.includes('status=REJECTED') && url.includes('pageSize=100'))).toBe(
        true,
      );
    });
  });

  it('shows a visible error instead of a silent zero when a stat count fails to load', async () => {
    server.use(
      http.get(`${API_URL}/moderation/queue`, () => HttpResponse.json([])),
      http.get(`${API_URL}/items`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('status') === 'PUBLISHED') {
          return HttpResponse.json({ error: { message: 'Boom' } }, { status: 500 });
        }
        return HttpResponse.json([]);
      }),
    );

    renderWithProviders(<ModerationPage />);

    expect(
      await screen.findByText("Couldn't load full counts for one or more stat cards. Please try again."),
    ).toBeInTheDocument();
  });

  it('shows a visible error when the moderation queue itself fails to load', async () => {
    server.use(
      http.get(`${API_URL}/moderation/queue`, () => HttpResponse.json({ error: { message: 'Boom' } }, { status: 500 })),
      http.get(`${API_URL}/items`, () => HttpResponse.json([])),
    );

    renderWithProviders(<ModerationPage />);

    expect(await screen.findByText("Couldn't load the moderation queue. Please try again.")).toBeInTheDocument();
  });
});

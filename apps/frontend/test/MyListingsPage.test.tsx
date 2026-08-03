import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './msw/server';
import { API_URL } from './msw/handlers';
import { renderWithProviders } from './test-utils';
import MyListingsPage from '../src/pages/MyListingsPage';

const MINE = [
  { id: 'item-1', title: 'Pending Item', status: 'PENDING', price: 20, condition: 'Good', photos: [] },
  { id: 'item-2', title: 'Published Item', status: 'PUBLISHED', price: 40, condition: 'Good', photos: [] },
  { id: 'item-3', title: 'Rejected Item', status: 'REJECTED', price: 10, condition: 'Fair', photos: [] },
];

describe('MyListingsPage', () => {
  it('renders own items across every status', async () => {
    server.use(http.get(`${API_URL}/items/mine`, () => HttpResponse.json(MINE)));
    renderWithProviders(<MyListingsPage />);

    expect(await screen.findByText('Pending Item')).toBeInTheDocument();
    expect(screen.getByText('Published Item')).toBeInTheDocument();
    expect(screen.getByText('Rejected Item')).toBeInTheDocument();
  });

  it('lets the contributor cancel a pending or published item, but not a rejected one', async () => {
    // GET /items/mine returns the caller's items "across every status" (see Task 1 backend
    // brief), so cancelling item-1 does not remove it from the list — it stays with status
    // CANCELLED. The mock below is stateful to reflect that: it returns the current in-memory
    // list, and the PATCH handler updates that state, so the refetch triggered by
    // useCancelItem's invalidateQueries reflects the real status transition.
    let mine = MINE.map((item) => ({ ...item }));
    server.use(
      http.get(`${API_URL}/items/mine`, () => HttpResponse.json(mine)),
      http.patch(`${API_URL}/items/item-1/cancel`, () => {
        mine = mine.map((item) => (item.id === 'item-1' ? { ...item, status: 'CANCELLED' } : item));
        return HttpResponse.json(mine.find((item) => item.id === 'item-1'));
      }),
    );
    renderWithProviders(<MyListingsPage />);
    await screen.findByText('Pending Item');

    const rejectedRow = screen.getByText('Rejected Item').closest('tr')!;
    expect(rejectedRow).not.toHaveTextContent('Cancel');

    const pendingRow = screen.getByText('Pending Item').closest('tr')!;
    await userEvent.click(within(pendingRow).getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      const updatedRow = screen.getByText('Pending Item').closest('tr')!;
      expect(updatedRow).toHaveTextContent('CANCELLED');
      expect(within(updatedRow).queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });
  });

  it('shows a visible error message when cancelling fails, instead of doing nothing silently', async () => {
    // Simulates the concrete failure mode from the review: a moderator rejects the item between
    // page load and the contributor's Cancel click, and the backend returns a 409 conflict.
    server.use(
      http.get(`${API_URL}/items/mine`, () => HttpResponse.json(MINE)),
      http.patch(`${API_URL}/items/item-1/cancel`, () =>
        HttpResponse.json({ error: { message: 'Item is no longer cancellable' } }, { status: 409 }),
      ),
    );
    renderWithProviders(<MyListingsPage />);
    const pendingRow = (await screen.findByText('Pending Item')).closest('tr')!;

    await userEvent.click(within(pendingRow).getByRole('button', { name: /cancel/i }));

    expect(await screen.findByText('Item is no longer cancellable')).toBeInTheDocument();
  });

  it('shows a visible error message when the listings themselves fail to load', async () => {
    server.use(
      http.get(`${API_URL}/items/mine`, () => HttpResponse.json({ error: { message: 'Boom' } }, { status: 500 })),
    );
    renderWithProviders(<MyListingsPage />);

    expect(await screen.findByText("Couldn't load your listings. Please try again.")).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from './msw/server';
import { API_URL } from './msw/handlers';
import { renderWithProviders } from './test-utils';
import ItemDetailPage from '../src/pages/ItemDetailPage';

const ITEM = {
  id: 'item-1',
  title: 'Sony a6000 Mirrorless Camera',
  description: 'Barely used.',
  price: 310,
  condition: 'Like new',
  isNegotiable: true,
  minPrice: 280,
  categoryId: 'cat-1',
  options: ['Delivery available', 'Original packaging'],
  contributorId: 'u1',
  status: 'PUBLISHED',
  reviewedById: null,
  reviewedAt: null,
  rejectionReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  photos: [
    { id: 'p1', url: '/uploads/a6000-1.jpg', position: 0, isPrimary: true },
    { id: 'p2', url: '/uploads/a6000-2.jpg', position: 1, isPrimary: false },
  ],
};

function loginAs(user: { id: string; role: 'CONTRIBUTOR' | 'MODERATOR' }) {
  localStorage.setItem('reloop_token', 'tok-1');
  localStorage.setItem(
    'reloop_user',
    JSON.stringify({ id: user.id, email: 'user@example.com', name: 'Test User', role: user.role }),
  );
}

describe('ItemDetailPage', () => {
  it('renders the full listing', async () => {
    server.use(http.get(`${API_URL}/items/item-1`, () => HttpResponse.json(ITEM)));

    renderWithProviders(
      <Routes>
        <Route path="/items/:id" element={<ItemDetailPage />} />
      </Routes>,
      { route: '/items/item-1' },
    );

    expect(await screen.findByText('Sony a6000 Mirrorless Camera')).toBeInTheDocument();
    expect(screen.getByText('$310')).toBeInTheDocument();
    expect(screen.getByText(/negotiable/i)).toBeInTheDocument();
    expect(screen.getByText('Delivery available')).toBeInTheDocument();
    expect(screen.getByText('Original packaging')).toBeInTheDocument();
  });

  it('shows a visible error message when the item fails to load', async () => {
    server.use(
      http.get(`${API_URL}/items/item-1`, () => HttpResponse.json({ error: { message: 'Boom' } }, { status: 500 })),
    );

    renderWithProviders(
      <Routes>
        <Route path="/items/:id" element={<ItemDetailPage />} />
      </Routes>,
      { route: '/items/item-1' },
    );

    expect(await screen.findByText("Couldn't load this listing. Please try again.")).toBeInTheDocument();
  });

  it('shows a visible error message when cancelling fails, instead of doing nothing silently', async () => {
    loginAs({ id: 'u1', role: 'CONTRIBUTOR' });
    server.use(
      http.get(`${API_URL}/items/item-1`, () => HttpResponse.json(ITEM)),
      http.patch(`${API_URL}/items/item-1/cancel`, () =>
        HttpResponse.json({ error: { message: 'Item is no longer cancellable' } }, { status: 409 }),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/items/:id" element={<ItemDetailPage />} />
      </Routes>,
      { route: '/items/item-1' },
    );

    await userEvent.click(await screen.findByRole('button', { name: /cancel listing/i }));

    expect(await screen.findByText('Item is no longer cancellable')).toBeInTheDocument();
  });

  it('shows a visible error message when deleting fails, instead of doing nothing silently', async () => {
    loginAs({ id: 'mod-1', role: 'MODERATOR' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    server.use(
      http.get(`${API_URL}/items/item-1`, () => HttpResponse.json(ITEM)),
      http.delete(`${API_URL}/items/item-1`, () =>
        HttpResponse.json({ error: { message: 'Cannot delete a published item' } }, { status: 409 }),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/items/:id" element={<ItemDetailPage />} />
      </Routes>,
      { route: '/items/item-1' },
    );

    await userEvent.click(await screen.findByRole('button', { name: /^delete$/i }));

    expect(await screen.findByText('Cannot delete a published item')).toBeInTheDocument();
  });
});

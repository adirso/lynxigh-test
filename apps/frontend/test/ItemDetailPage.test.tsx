import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
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
});

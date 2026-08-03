import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from './msw/server';
import { API_URL } from './msw/handlers';
import { renderWithProviders } from './test-utils';
import EditListingPage from '../src/pages/EditListingPage';

const ITEM = {
  id: 'item-1',
  title: 'Solid Oak Bookshelf',
  description: 'Five shelves.',
  price: 85,
  condition: 'Like new',
  isNegotiable: false,
  categoryId: 'cat-2',
  options: [],
  contributorId: 'u1',
  status: 'PENDING',
  reviewedById: null,
  reviewedAt: null,
  rejectionReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  photos: [{ id: 'p1', url: '/uploads/bookshelf.jpg', position: 0, isPrimary: true }],
};

describe('EditListingPage', () => {
  it('pre-fills the form from the fetched item and submits an update', async () => {
    server.use(
      http.get(`${API_URL}/categories`, () => HttpResponse.json([{ id: 'cat-2', name: 'Furniture' }])),
      http.get(`${API_URL}/items/item-1`, () => HttpResponse.json(ITEM)),
      http.put(`${API_URL}/items/item-1`, () => HttpResponse.json({ ...ITEM, title: 'Corrected Title' })),
    );

    renderWithProviders(
      <Routes>
        <Route path="/items/:id/edit" element={<EditListingPage />} />
      </Routes>,
      { route: '/items/item-1/edit' },
    );

    const titleInput = await screen.findByLabelText(/^title$/i);
    expect(titleInput).toHaveValue('Solid Oak Bookshelf');

    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Corrected Title');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/updated/i)).toBeInTheDocument();
    });
  });
});

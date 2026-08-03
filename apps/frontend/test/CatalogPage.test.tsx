import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './msw/server';
import { API_URL } from './msw/handlers';
import { renderWithProviders } from './test-utils';
import CatalogPage from '../src/pages/CatalogPage';

const ITEMS = [
  {
    id: 'item-1',
    title: 'Mid-Century Armchair',
    price: 180,
    condition: 'Good',
    categoryId: 'cat-2',
    options: [],
    contributorId: 'u1',
    status: 'PUBLISHED',
    reviewedById: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isNegotiable: false,
    description: 'A chair.',
    photos: [{ id: 'p1', url: '/uploads/chair.jpg', position: 0, isPrimary: true }],
  },
];

describe('CatalogPage', () => {
  it('renders published items from the API', async () => {
    server.use(http.get(`${API_URL}/items`, () => HttpResponse.json(ITEMS)));

    renderWithProviders(<CatalogPage />);

    expect(await screen.findByText('Mid-Century Armchair')).toBeInTheDocument();
    expect(screen.getByText('$180')).toBeInTheDocument();
  });

  it('refetches with a category filter when one is selected', async () => {
    let lastUrl = '';
    server.use(
      http.get(`${API_URL}/items`, ({ request }) => {
        lastUrl = request.url;
        return HttpResponse.json(ITEMS);
      }),
    );

    renderWithProviders(<CatalogPage />);
    await screen.findByText('Mid-Century Armchair');

    await userEvent.selectOptions(screen.getByLabelText(/category/i), 'cat-2');

    await waitFor(() => {
      expect(lastUrl).toContain('categoryId=cat-2');
    });
  });
});

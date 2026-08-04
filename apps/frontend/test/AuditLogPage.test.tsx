import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from './msw/server';
import { API_URL } from './msw/handlers';
import { renderWithProviders } from './test-utils';
import AuditLogPage from '../src/pages/AuditLogPage';

const ENTRIES = [
  {
    type: 'EDIT',
    id: 'edit-1',
    itemId: 'item-1',
    itemTitle: 'Solid Oak Bookshelf',
    actorId: 'mod-1',
    actorName: 'Morgan',
    before: {
      title: 'Solid Oak Bookshelf',
      description: 'x',
      price: 85,
      condition: 'Good',
      isNegotiable: false,
      minPrice: null,
      categoryId: 'cat-1',
      options: [],
    },
    after: {
      title: 'Solid Oak Bookshelf',
      description: 'x',
      price: 60,
      condition: 'Good',
      isNegotiable: false,
      minPrice: null,
      categoryId: 'cat-1',
      options: [],
    },
    createdAt: '2026-01-02T00:00:00.000Z',
  },
  {
    type: 'STATUS_CHANGE',
    id: 'status-1',
    itemId: 'item-1',
    itemTitle: 'Solid Oak Bookshelf',
    actorId: 'mod-1',
    actorName: 'Morgan',
    fromStatus: 'PENDING',
    toStatus: 'PUBLISHED',
    reason: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('AuditLogPage', () => {
  it('renders both status-change and edit entries with their detail', async () => {
    server.use(http.get(`${API_URL}/admin/audit-log`, () => HttpResponse.json(ENTRIES)));
    renderWithProviders(<AuditLogPage />);

    expect(await screen.findAllByText('Solid Oak Bookshelf')).toHaveLength(2);
    expect(screen.getAllByText('Morgan')).toHaveLength(2);
    expect(screen.getByText(/PENDING/)).toBeInTheDocument();
    expect(screen.getByText(/PUBLISHED/)).toBeInTheDocument();
    // The edit entry should surface that price changed, not just "something changed".
    expect(screen.getByText(/price/i)).toBeInTheDocument();
    expect(screen.getByText(/85/)).toBeInTheDocument();
    expect(screen.getByText(/60/)).toBeInTheDocument();
  });

  it('shows an empty state with no entries', async () => {
    server.use(http.get(`${API_URL}/admin/audit-log`, () => HttpResponse.json([])));
    renderWithProviders(<AuditLogPage />);

    expect(await screen.findByText(/no activity yet/i)).toBeInTheDocument();
  });
});

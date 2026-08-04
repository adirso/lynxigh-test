import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './msw/server';
import { API_URL } from './msw/handlers';
import { renderWithProviders } from './test-utils';
import CategoriesAdminPage from '../src/pages/CategoriesAdminPage';

const CATEGORIES = [
  { id: 'cat-1', name: 'Electronics' },
  { id: 'cat-2', name: 'Furniture' },
];

describe('CategoriesAdminPage', () => {
  it('lists existing categories', async () => {
    server.use(http.get(`${API_URL}/categories`, () => HttpResponse.json(CATEGORIES)));
    renderWithProviders(<CategoriesAdminPage />);

    expect(await screen.findByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('Furniture')).toBeInTheDocument();
  });

  it('creates a new category', async () => {
    let categories = [...CATEGORIES];
    server.use(
      http.get(`${API_URL}/categories`, () => HttpResponse.json(categories)),
      http.post(`${API_URL}/categories`, async ({ request }) => {
        const body = (await request.json()) as { name: string };
        const created = { id: 'cat-3', name: body.name };
        categories = [...categories, created];
        return HttpResponse.json(created, { status: 201 });
      }),
    );
    renderWithProviders(<CategoriesAdminPage />);
    await screen.findByText('Electronics');

    await userEvent.type(screen.getByLabelText(/new category name/i), 'Books');
    await userEvent.click(screen.getByRole('button', { name: /add category/i }));

    await waitFor(() => {
      expect(screen.getByText('Books')).toBeInTheDocument();
    });
  });

  it('renames a category', async () => {
    let categories = [...CATEGORIES];
    server.use(
      http.get(`${API_URL}/categories`, () => HttpResponse.json(categories)),
      http.put(`${API_URL}/categories/cat-1`, async ({ request }) => {
        const body = (await request.json()) as { name: string };
        categories = categories.map((c) => (c.id === 'cat-1' ? { ...c, name: body.name } : c));
        return HttpResponse.json({ id: 'cat-1', name: body.name });
      }),
    );
    renderWithProviders(<CategoriesAdminPage />);
    const row = (await screen.findByText('Electronics')).closest('tr')!;

    await userEvent.click(within(row).getByRole('button', { name: /rename/i }));
    const input = within(row).getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'Consumer Electronics');
    await userEvent.click(within(row).getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText('Consumer Electronics')).toBeInTheDocument();
    });
  });

  it('deletes a category and shows an error if the server rejects it', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    server.use(
      http.get(`${API_URL}/categories`, () => HttpResponse.json(CATEGORIES)),
      http.delete(`${API_URL}/categories/cat-1`, () =>
        HttpResponse.json({ error: { message: 'Cannot delete a category that still has items assigned to it' } }, { status: 409 }),
      ),
    );
    renderWithProviders(<CategoriesAdminPage />);
    const row = (await screen.findByText('Electronics')).closest('tr')!;

    await userEvent.click(within(row).getByRole('button', { name: /delete/i }));

    expect(await screen.findByText(/cannot delete a category that still has items/i)).toBeInTheDocument();
  });
});

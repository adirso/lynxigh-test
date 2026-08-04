import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from './msw/server';
import { API_URL } from './msw/handlers';
import ItemForm from '../src/components/ItemForm';

function renderForm(onSubmit = vi.fn(), { requirePhotos = false } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ItemForm onSubmit={onSubmit} submitLabel="Submit for review" requirePhotos={requirePhotos} />
    </QueryClientProvider>,
  );
  return onSubmit;
}

describe('ItemForm', () => {
  it('only shows the minimum price field when negotiable is Yes', async () => {
    server.use(http.get(`${API_URL}/categories`, () => HttpResponse.json([{ id: 'cat-1', name: 'Electronics' }])));
    renderForm();

    expect(screen.queryByLabelText(/minimum acceptable price/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/^yes$/i));
    expect(screen.getByLabelText(/minimum acceptable price/i)).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/^no$/i));
    expect(screen.queryByLabelText(/minimum acceptable price/i)).not.toBeInTheDocument();
  });

  it('calls onSubmit with the entered values', async () => {
    server.use(http.get(`${API_URL}/categories`, () => HttpResponse.json([{ id: 'cat-1', name: 'Electronics' }])));
    const onSubmit = renderForm();

    await userEvent.type(screen.getByLabelText(/^title$/i), 'Standing Desk');
    await userEvent.type(screen.getByLabelText(/description/i), 'Great condition.');
    await userEvent.type(screen.getByLabelText(/^price/i), '95');
    await userEvent.selectOptions(screen.getByLabelText(/condition/i), 'Like new');
    await userEvent.selectOptions(screen.getByLabelText(/category/i), 'cat-1');
    await userEvent.click(screen.getByLabelText('Local pickup'));
    await userEvent.click(screen.getByRole('button', { name: /submit for review/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Standing Desk',
        description: 'Great condition.',
        price: 95,
        condition: 'Like new',
        categoryId: 'cat-1',
        isNegotiable: false,
        options: ['Local pickup'],
      }),
    );
  });

  it('shows a visible error message when categories fail to load', async () => {
    server.use(
      http.get(`${API_URL}/categories`, () => HttpResponse.json({ error: { message: 'Boom' } }, { status: 500 })),
    );
    renderForm();

    expect(await screen.findByText("Couldn't load categories. Please try again.")).toBeInTheDocument();
  });

  describe('AI description generation', () => {
    it('hides the button on the edit flow (requirePhotos=false)', () => {
      server.use(http.get(`${API_URL}/categories`, () => HttpResponse.json([{ id: 'cat-1', name: 'Electronics' }])));
      renderForm(vi.fn(), { requirePhotos: false });
      expect(screen.queryByRole('button', { name: /generate with ai/i })).not.toBeInTheDocument();
    });

    it('hides the button when the AI service is unavailable', async () => {
      server.use(
        http.get(`${API_URL}/categories`, () => HttpResponse.json([{ id: 'cat-1', name: 'Electronics' }])),
        http.get(`${API_URL}/ai/status`, () => HttpResponse.json({ available: false })),
      );
      renderForm(vi.fn(), { requirePhotos: true });
      await screen.findByLabelText(/photos/i);
      expect(screen.queryByRole('button', { name: /generate with ai/i })).not.toBeInTheDocument();
    });

    it('disables the button until at least one photo is picked', async () => {
      server.use(
        http.get(`${API_URL}/categories`, () => HttpResponse.json([{ id: 'cat-1', name: 'Electronics' }])),
        http.get(`${API_URL}/ai/status`, () => HttpResponse.json({ available: true })),
      );
      renderForm(vi.fn(), { requirePhotos: true });
      const button = await screen.findByRole('button', { name: /generate with ai/i });
      expect(button).toBeDisabled();

      const file = new File(['fake-bytes'], 'photo.jpg', { type: 'image/jpeg' });
      await userEvent.upload(screen.getByLabelText(/photos/i), file);
      expect(button).toBeEnabled();
    });

    it('fills the description field with the generated text on success, overwriting any existing text', async () => {
      server.use(
        http.get(`${API_URL}/categories`, () => HttpResponse.json([{ id: 'cat-1', name: 'Electronics' }])),
        http.get(`${API_URL}/ai/status`, () => HttpResponse.json({ available: true })),
        http.post(`${API_URL}/ai/generate-description`, () =>
          HttpResponse.json({ description: 'A sturdy oak desk in great condition.' }),
        ),
      );
      renderForm(vi.fn(), { requirePhotos: true });

      const file = new File(['fake-bytes'], 'photo.jpg', { type: 'image/jpeg' });
      await userEvent.upload(screen.getByLabelText(/photos/i), file);
      await userEvent.type(screen.getByLabelText(/description/i), 'draft text to overwrite');

      await userEvent.click(await screen.findByRole('button', { name: /generate with ai/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/description/i)).toHaveValue('A sturdy oak desk in great condition.');
      });
    });

    it('shows an inline error and leaves the textarea untouched on failure', async () => {
      server.use(
        http.get(`${API_URL}/categories`, () => HttpResponse.json([{ id: 'cat-1', name: 'Electronics' }])),
        http.get(`${API_URL}/ai/status`, () => HttpResponse.json({ available: true })),
        http.post(`${API_URL}/ai/generate-description`, () =>
          HttpResponse.json({ error: { message: 'AI description generation failed' } }, { status: 502 }),
        ),
      );
      renderForm(vi.fn(), { requirePhotos: true });

      const file = new File(['fake-bytes'], 'photo.jpg', { type: 'image/jpeg' });
      await userEvent.upload(screen.getByLabelText(/photos/i), file);
      await userEvent.type(screen.getByLabelText(/description/i), 'keep me');

      await userEvent.click(await screen.findByRole('button', { name: /generate with ai/i }));

      await waitFor(() => {
        expect(screen.getByText(/couldn't generate a description/i)).toBeInTheDocument();
      });
      expect(screen.getByLabelText(/description/i)).toHaveValue('keep me');
    });
  });
});

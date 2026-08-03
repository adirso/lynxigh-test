import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from './msw/server';
import { API_URL } from './msw/handlers';
import ItemForm from '../src/components/ItemForm';

function renderForm(onSubmit = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ItemForm onSubmit={onSubmit} submitLabel="Submit for review" />
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
});

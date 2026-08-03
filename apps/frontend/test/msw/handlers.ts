import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:4000';

export const handlers = [
  http.get(`${API_URL}/categories`, () =>
    HttpResponse.json([
      { id: 'cat-1', name: 'Electronics' },
      { id: 'cat-2', name: 'Furniture' },
    ]),
  ),
];

export { API_URL };

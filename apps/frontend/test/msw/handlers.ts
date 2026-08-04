import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:4000';

export const handlers = [
  http.get(`${API_URL}/categories`, () =>
    HttpResponse.json([
      { id: 'cat-1', name: 'Electronics' },
      { id: 'cat-2', name: 'Furniture' },
    ]),
  ),
  // Default: session validation just confirms whatever's cached in
  // localStorage, matching AuthProvider's own optimistic hydration. Tests
  // that pre-seed a logged-in session via `reloop_user` get a working
  // /auth/me for free; tests that specifically exercise revalidation
  // (a changed/deleted account) override this with server.use(...).
  http.get(`${API_URL}/auth/me`, () => {
    const raw = localStorage.getItem('reloop_user');
    if (!raw) {
      return HttpResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }
    return HttpResponse.json(JSON.parse(raw));
  }),
  // Default: AI description generation is unavailable, matching a dev/CI
  // environment with no OPENAI_API_KEY configured — the "Generate with AI"
  // button stays hidden. Tests that specifically exercise the button
  // override this with server.use(...).
  http.get(`${API_URL}/ai/status`, () => HttpResponse.json({ available: false })),
];

export { API_URL };

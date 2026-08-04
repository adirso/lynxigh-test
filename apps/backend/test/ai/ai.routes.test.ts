import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDb } from '../helpers/db-reset.js';
import { prisma } from '../../src/db.js';
import { registerAndLogin } from '../helpers/factories.js';

const app = createApp();

describe('/ai routes', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    await resetDb();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('rejects an unauthenticated GET /ai/status', async () => {
    const res = await request(app).get('/ai/status');
    expect(res.status).toBe(401);
  });

  it('rejects an unauthenticated POST /ai/generate-description', async () => {
    const res = await request(app)
      .post('/ai/generate-description')
      .field('condition', 'Good')
      .field('options', JSON.stringify([]))
      .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');
    expect(res.status).toBe(401);
  });

  it('rejects a moderator on POST /ai/generate-description', async () => {
    const { token } = await registerAndLogin(app, 'MODERATOR');
    const res = await request(app)
      .post('/ai/generate-description')
      .set('Authorization', `Bearer ${token}`)
      .field('condition', 'Good')
      .field('options', JSON.stringify([]))
      .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');
    expect(res.status).toBe(403);
  });

  describe('when OPENAI_API_KEY is not set', () => {
    beforeEach(() => {
      delete process.env.OPENAI_API_KEY;
    });

    it('GET /ai/status reports unavailable', async () => {
      const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
      const res = await request(app).get('/ai/status').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ available: false });
    });

    it('POST /ai/generate-description returns 503', async () => {
      const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
      const res = await request(app)
        .post('/ai/generate-description')
        .set('Authorization', `Bearer ${token}`)
        .field('condition', 'Good')
        .field('options', JSON.stringify([]))
        .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');
      expect(res.status).toBe(503);
    });
  });

  describe('when OPENAI_API_KEY is set', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'sk-test-fake-key';
      process.env.OPENAI_MODEL = 'gpt-4o-mini';
    });

    it('GET /ai/status reports available', async () => {
      const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
      const res = await request(app).get('/ai/status').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ available: true });
    });

    it('generates and returns a description on a successful OpenAI response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ choices: [{ message: { content: 'A sturdy oak desk.' } }] }), {
            status: 200,
          }),
        ),
      );
      const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
      const category = await prisma.category.findFirstOrThrow();

      const res = await request(app)
        .post('/ai/generate-description')
        .set('Authorization', `Bearer ${token}`)
        .field('title', 'Standing Desk')
        .field('categoryId', category.id)
        .field('condition', 'Good')
        .field('options', JSON.stringify(['Local pickup']))
        .attach('photos', Buffer.from('fake-image-bytes'), 'desk.jpg');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ description: 'A sturdy oak desk.' });
    });

    it('generates a description without a category when categoryId is omitted', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify({ choices: [{ message: { content: 'A nice item.' } }] }), { status: 200 }),
          ),
      );
      const { token } = await registerAndLogin(app, 'CONTRIBUTOR');

      const res = await request(app)
        .post('/ai/generate-description')
        .set('Authorization', `Bearer ${token}`)
        .field('condition', 'Good')
        .field('options', JSON.stringify([]))
        .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ description: 'A nice item.' });
    });

    it('returns 502 when the OpenAI call fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 })));
      const { token } = await registerAndLogin(app, 'CONTRIBUTOR');

      const res = await request(app)
        .post('/ai/generate-description')
        .set('Authorization', `Bearer ${token}`)
        .field('condition', 'Good')
        .field('options', JSON.stringify([]))
        .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');

      expect(res.status).toBe(502);
    });

    it('rejects a well-formed but nonexistent categoryId with 400', async () => {
      const { token } = await registerAndLogin(app, 'CONTRIBUTOR');

      const res = await request(app)
        .post('/ai/generate-description')
        .set('Authorization', `Bearer ${token}`)
        .field('categoryId', '00000000-0000-0000-0000-000000000000')
        .field('condition', 'Good')
        .field('options', JSON.stringify([]))
        .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');

      expect(res.status).toBe(400);
    });

    it('rejects a request with no photos', async () => {
      const { token } = await registerAndLogin(app, 'CONTRIBUTOR');

      const res = await request(app)
        .post('/ai/generate-description')
        .set('Authorization', `Bearer ${token}`)
        .field('condition', 'Good')
        .field('options', JSON.stringify([]));

      expect(res.status).toBe(400);
    });
  });
});

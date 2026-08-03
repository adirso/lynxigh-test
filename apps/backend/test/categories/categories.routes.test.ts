import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDb } from '../helpers/db-reset.js';
import { CATEGORY_NAMES } from '../../prisma/seed.js';

const app = createApp();

describe('GET /categories', () => {
  beforeEach(resetDb);

  it('returns all seeded categories', async () => {
    const res = await request(app).get('/categories');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(CATEGORY_NAMES.length);
    expect(res.body.map((c: { name: string }) => c.name).sort()).toEqual(
      [...CATEGORY_NAMES].sort(),
    );
  });
});

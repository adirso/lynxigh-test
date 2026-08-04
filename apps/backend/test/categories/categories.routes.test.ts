import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDb } from '../helpers/db-reset.js';
import { prisma } from '../../src/db.js';
import { CATEGORY_NAMES } from '../../prisma/seed.js';
import { registerAndLogin } from '../helpers/factories.js';

const app = createApp();

// categories are stable reference data — resetDb() deliberately never wipes
// them (only reseeds the canonical CATEGORY_NAMES via upsert). Any category a
// test creates or renames therefore persists in the shared dev/test database
// forever unless the test cleans up after itself. Tests below always use a
// randomUUID-suffixed name (never collides across repeated runs) and delete
// what they created; seeded categories are only ever read, never mutated,
// to avoid corrupting the reseed's upsert-by-name idempotency.
function uniqueCategoryName(label: string) {
  return `${label} ${randomUUID()}`;
}

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

describe('POST /categories (moderator category management)', () => {
  beforeEach(resetDb);

  it('lets a moderator create a new category', async () => {
    const { token } = await registerAndLogin(app, 'MODERATOR');
    const name = uniqueCategoryName('Musical Instruments');

    const res = await request(app).post('/categories').set('Authorization', `Bearer ${token}`).send({ name });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe(name);
    const inDb = await prisma.category.findUnique({ where: { name } });
    expect(inDb).not.toBeNull();

    await prisma.category.delete({ where: { id: res.body.id } });
  });

  it('rejects a duplicate category name with 409', async () => {
    const { token } = await registerAndLogin(app, 'MODERATOR');
    const existing = await prisma.category.findFirstOrThrow();

    const res = await request(app).post('/categories').set('Authorization', `Bearer ${token}`).send({
      name: existing.name,
    });

    expect(res.status).toBe(409);
  });

  it('rejects a contributor trying to create a category', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');

    const res = await request(app).post('/categories').set('Authorization', `Bearer ${token}`).send({
      name: uniqueCategoryName('Contraband'),
    });

    expect(res.status).toBe(403);
  });

  it('rejects an empty name with 400', async () => {
    const { token } = await registerAndLogin(app, 'MODERATOR');

    const res = await request(app).post('/categories').set('Authorization', `Bearer ${token}`).send({ name: '' });

    expect(res.status).toBe(400);
  });
});

describe('PUT /categories/:id (rename)', () => {
  beforeEach(resetDb);

  it('lets a moderator rename a category', async () => {
    const { token } = await registerAndLogin(app, 'MODERATOR');
    // A throwaway category, never a seeded one — renaming a seeded category
    // would break the reseed's upsert-by-name match on the next resetDb().
    const category = await prisma.category.create({ data: { name: uniqueCategoryName('Before Rename') } });
    const newName = uniqueCategoryName('Renamed Category');

    const res = await request(app)
      .put(`/categories/${category.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: newName });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe(newName);

    await prisma.category.delete({ where: { id: category.id } });
  });

  it('rejects renaming to a name that already exists with 409', async () => {
    const { token } = await registerAndLogin(app, 'MODERATOR');
    // Both throwaway — the rename is expected to be rejected (no write
    // happens), but using seeded categories here isn't worth the risk.
    const categoryA = await prisma.category.create({ data: { name: uniqueCategoryName('Category A') } });
    const categoryB = await prisma.category.create({ data: { name: uniqueCategoryName('Category B') } });

    const res = await request(app)
      .put(`/categories/${categoryA.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: categoryB.name });

    expect(res.status).toBe(409);

    await prisma.category.deleteMany({ where: { id: { in: [categoryA.id, categoryB.id] } } });
  });

  it('returns 404 for a nonexistent category', async () => {
    const { token } = await registerAndLogin(app, 'MODERATOR');

    const res = await request(app)
      .put('/categories/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: uniqueCategoryName('Ghost Category') });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /categories/:id', () => {
  beforeEach(resetDb);

  it('lets a moderator delete a category with no items', async () => {
    const { token } = await registerAndLogin(app, 'MODERATOR');
    const created = await prisma.category.create({ data: { name: uniqueCategoryName('Ephemeral Category') } });

    const res = await request(app).delete(`/categories/${created.id}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
    const found = await prisma.category.findUnique({ where: { id: created.id } });
    expect(found).toBeNull();
  });

  it('rejects deleting a category that still has items with 409', async () => {
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    // Seeded category is fine here — the delete is expected to be rejected,
    // so it's never actually removed (no corruption risk).
    const category = await prisma.category.findFirstOrThrow();

    await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${contributorToken}`)
      .field('title', 'Occupant Item')
      .field('description', 'Keeps the category alive.')
      .field('price', '10')
      .field('condition', 'Good')
      .field('isNegotiable', 'false')
      .field('categoryId', category.id)
      .field('options', JSON.stringify([]))
      .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');

    const res = await request(app).delete(`/categories/${category.id}`).set('Authorization', `Bearer ${modToken}`);

    expect(res.status).toBe(409);
    const stillThere = await prisma.category.findUnique({ where: { id: category.id } });
    expect(stillThere).not.toBeNull();
  });

  it('returns 404 for a nonexistent category', async () => {
    const { token } = await registerAndLogin(app, 'MODERATOR');

    const res = await request(app)
      .delete('/categories/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

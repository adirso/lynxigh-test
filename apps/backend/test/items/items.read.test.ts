import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDb } from '../helpers/db-reset.js';
import { prisma } from '../../src/db.js';
import { registerAndLogin } from '../helpers/factories.js';

const app = createApp();

async function createPendingItem(token: string, categoryId: string, overrides: Partial<Record<string, string>> = {}) {
  const res = await request(app)
    .post('/items')
    .set('Authorization', `Bearer ${token}`)
    .field('title', overrides.title ?? 'Test Item')
    .field('description', 'A test item.')
    .field('price', overrides.price ?? '20')
    .field('condition', overrides.condition ?? 'Good')
    .field('isNegotiable', 'false')
    .field('categoryId', categoryId)
    .field('options', JSON.stringify([]))
    .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');
  return res.body;
}

describe('GET /items and GET /items/:id', () => {
  beforeEach(resetDb);

  it('excludes pending items from the public list', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();
    await createPendingItem(token, category.id);

    const res = await request(app).get('/items');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('returns published items to the public', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createPendingItem(token, category.id, { title: 'Published Item' });
    await prisma.item.update({ where: { id: item.id }, data: { status: 'PUBLISHED' } });

    const res = await request(app).get('/items');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Published Item');
  });

  it('lets a moderator see pending items in the list', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    await createPendingItem(contributorToken, category.id);

    const res = await request(app)
      .get('/items?status=PENDING')
      .set('Authorization', `Bearer ${modToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('returns 404 for a pending item detail requested anonymously', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createPendingItem(token, category.id);

    const res = await request(app).get(`/items/${item.id}`);
    expect(res.status).toBe(404);
  });

  it('returns a pending item detail to a moderator', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createPendingItem(contributorToken, category.id);

    const res = await request(app)
      .get(`/items/${item.id}`)
      .set('Authorization', `Bearer ${modToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(item.id);
  });

  it('filters the public list by category', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const categories = await prisma.category.findMany();
    const itemA = await createPendingItem(token, categories[0].id, { title: 'A' });
    const itemB = await createPendingItem(token, categories[1].id, { title: 'B' });
    await prisma.item.update({ where: { id: itemA.id }, data: { status: 'PUBLISHED' } });
    await prisma.item.update({ where: { id: itemB.id }, data: { status: 'PUBLISHED' } });

    const res = await request(app).get(`/items?categoryId=${categories[0].id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('A');
  });
});

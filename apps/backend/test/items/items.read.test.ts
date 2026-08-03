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

  it('rejects a bogus ?status= value with 400 instead of a 500', async () => {
    const res = await request(app).get('/items?status=NOT_A_REAL_STATUS');
    expect(res.status).toBe(400);
  });

  it('rejects a non-numeric ?page= value with 400 instead of a 500', async () => {
    const res = await request(app).get('/items?page=banana');
    expect(res.status).toBe(400);
  });

  it('rejects ?page=0 with 400 instead of a 500', async () => {
    const res = await request(app).get('/items?page=0');
    expect(res.status).toBe(400);
  });

  it('rejects a negative ?page= with 400 instead of a 500', async () => {
    const res = await request(app).get('/items?page=-1');
    expect(res.status).toBe(400);
  });

  it('rejects a non-numeric ?pageSize= value with 400 instead of a 500', async () => {
    const res = await request(app).get('/items?pageSize=banana');
    expect(res.status).toBe(400);
  });

  it('hides minPrice and AI moderation fields from anonymous and non-owner viewers, but shows them to the owner and a moderator', async () => {
    const { token: ownerToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: otherToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();

    const createRes = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('title', 'Negotiable Item')
      .field('description', 'Open to offers.')
      .field('price', '100')
      .field('condition', 'Good')
      .field('isNegotiable', 'true')
      .field('minPrice', '70')
      .field('categoryId', category.id)
      .field('options', JSON.stringify([]))
      .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');

    const itemId = createRes.body.id;
    await prisma.item.update({
      where: { id: itemId },
      data: { status: 'PUBLISHED', aiFlagged: true, aiFlagReason: 'Possible counterfeit', aiConfidence: 0.82 },
    });

    const anonRes = await request(app).get(`/items/${itemId}`);
    expect(anonRes.status).toBe(200);
    expect(anonRes.body.minPrice).toBeUndefined();
    expect(anonRes.body.aiFlagged).toBeUndefined();
    expect(anonRes.body.aiFlagReason).toBeUndefined();
    expect(anonRes.body.aiConfidence).toBeUndefined();

    const otherRes = await request(app).get(`/items/${itemId}`).set('Authorization', `Bearer ${otherToken}`);
    expect(otherRes.status).toBe(200);
    expect(otherRes.body.minPrice).toBeUndefined();
    expect(otherRes.body.aiFlagged).toBeUndefined();

    const ownerRes = await request(app).get(`/items/${itemId}`).set('Authorization', `Bearer ${ownerToken}`);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.minPrice).toBe(70);
    expect(ownerRes.body.aiFlagged).toBe(true);
    expect(ownerRes.body.aiFlagReason).toBe('Possible counterfeit');
    expect(ownerRes.body.aiConfidence).toBe(0.82);

    const modRes = await request(app).get(`/items/${itemId}`).set('Authorization', `Bearer ${modToken}`);
    expect(modRes.status).toBe(200);
    expect(modRes.body.minPrice).toBe(70);
    expect(modRes.body.aiFlagged).toBe(true);
    expect(modRes.body.aiFlagReason).toBe('Possible counterfeit');
    expect(modRes.body.aiConfidence).toBe(0.82);

    // Same privilege check applies to the list endpoint.
    const anonListRes = await request(app).get('/items');
    const anonListItem = anonListRes.body.find((i: { id: string }) => i.id === itemId);
    expect(anonListItem.minPrice).toBeUndefined();

    const modListRes = await request(app)
      .get('/items?status=PUBLISHED')
      .set('Authorization', `Bearer ${modToken}`);
    const modListItem = modListRes.body.find((i: { id: string }) => i.id === itemId);
    expect(modListItem.minPrice).toBe(70);
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

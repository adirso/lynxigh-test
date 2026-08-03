import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDb } from '../helpers/db-reset.js';
import { prisma } from '../../src/db.js';
import { registerAndLogin } from '../helpers/factories.js';

const app = createApp();

async function createItem(token: string, categoryId: string) {
  const res = await request(app)
    .post('/items')
    .set('Authorization', `Bearer ${token}`)
    .field('title', 'Queue Item')
    .field('description', 'For moderation tests.')
    .field('price', '25')
    .field('condition', 'Good')
    .field('isNegotiable', 'false')
    .field('categoryId', categoryId)
    .field('options', JSON.stringify([]))
    .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');
  return res.body;
}

describe('moderation queue, approve, reject', () => {
  beforeEach(resetDb);

  it('lists only pending items in the queue, oldest first', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    const first = await createItem(contributorToken, category.id);
    const second = await createItem(contributorToken, category.id);
    await prisma.item.update({ where: { id: second.id }, data: { status: 'PUBLISHED' } });

    const res = await request(app).get('/moderation/queue').set('Authorization', `Bearer ${modToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(first.id);
  });

  it('rejects a contributor from viewing the queue', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const res = await request(app).get('/moderation/queue').set('Authorization', `Bearer ${contributorToken}`);
    expect(res.status).toBe(403);
  });

  it('approves a pending item', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(contributorToken, category.id);

    const res = await request(app)
      .post(`/items/${item.id}/approve`)
      .set('Authorization', `Bearer ${modToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PUBLISHED');
    expect(res.body.reviewedById).toEqual(expect.any(String));
  });

  it('rejects approving an item that is not pending', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(contributorToken, category.id);
    await prisma.item.update({ where: { id: item.id }, data: { status: 'PUBLISHED' } });

    const res = await request(app)
      .post(`/items/${item.id}/approve`)
      .set('Authorization', `Bearer ${modToken}`);

    expect(res.status).toBe(409);
  });

  it('rejects a pending item with a reason', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(contributorToken, category.id);

    const res = await request(app)
      .post(`/items/${item.id}/reject`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({ reason: 'Photos do not match the description' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REJECTED');
    expect(res.body.rejectionReason).toBe('Photos do not match the description');
  });

  it('requires a reason to reject', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(contributorToken, category.id);

    const res = await request(app)
      .post(`/items/${item.id}/reject`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

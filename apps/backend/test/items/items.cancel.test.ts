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
    .field('title', 'Cancel Me')
    .field('description', 'For cancel tests.')
    .field('price', '15')
    .field('condition', 'Good')
    .field('isNegotiable', 'false')
    .field('categoryId', categoryId)
    .field('options', JSON.stringify([]))
    .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');
  return res.body;
}

describe('PATCH /items/:id/cancel', () => {
  beforeEach(resetDb);

  it('lets the owning contributor cancel a pending item', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(token, category.id);

    const res = await request(app)
      .patch(`/items/${item.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');

    const events = await prisma.statusEvent.findMany({
      where: { itemId: item.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(events.at(-1)).toMatchObject({ fromStatus: 'PENDING', toStatus: 'CANCELLED' });
  });

  it('rejects cancellation by a different contributor', async () => {
    const { token: ownerToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: otherToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(ownerToken, category.id);

    const res = await request(app)
      .patch(`/items/${item.id}/cancel`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('rejects cancelling an already-rejected item', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(token, category.id);
    await prisma.item.update({ where: { id: item.id }, data: { status: 'REJECTED' } });

    const res = await request(app)
      .patch(`/items/${item.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });
});

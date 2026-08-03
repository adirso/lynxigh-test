import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDb } from '../helpers/db-reset.js';
import { prisma } from '../../src/db.js';
import { registerAndLogin } from '../helpers/factories.js';

const app = createApp();

async function createItem(token: string, categoryId: string, title: string) {
  const res = await request(app)
    .post('/items')
    .set('Authorization', `Bearer ${token}`)
    .field('title', title)
    .field('description', 'For mine tests.')
    .field('price', '20')
    .field('condition', 'Good')
    .field('isNegotiable', 'false')
    .field('categoryId', categoryId)
    .field('options', JSON.stringify([]))
    .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');
  return res.body;
}

describe('GET /items/mine', () => {
  beforeEach(resetDb);

  it("returns only the caller's own items, across every status", async () => {
    const { token: mine } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: other } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();

    const pending = await createItem(mine, category.id, 'Mine Pending');
    const published = await createItem(mine, category.id, 'Mine Published');
    await prisma.item.update({ where: { id: published.id }, data: { status: 'PUBLISHED' } });
    await createItem(other, category.id, 'Not Mine');

    const res = await request(app).get('/items/mine').set('Authorization', `Bearer ${mine}`);

    expect(res.status).toBe(200);
    expect(res.body.map((i: { title: string }) => i.title).sort()).toEqual(
      ['Mine Pending', 'Mine Published'].sort(),
    );
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/items/mine');
    expect(res.status).toBe(401);
  });

  it('rejects a moderator (endpoint is contributor-only)', async () => {
    const { token } = await registerAndLogin(app, 'MODERATOR');
    const res = await request(app).get('/items/mine').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

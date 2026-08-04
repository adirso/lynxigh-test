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
    .field('title', 'Editable Item')
    .field('description', 'Original description.')
    .field('price', '30')
    .field('condition', 'Good')
    .field('isNegotiable', 'false')
    .field('categoryId', categoryId)
    .field('options', JSON.stringify([]))
    .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');
  return res.body;
}

describe('PUT /items/:id and DELETE /items/:id (moderator)', () => {
  beforeEach(resetDb);

  it('lets a moderator edit any item', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(contributorToken, category.id);

    const res = await request(app)
      .put(`/items/${item.id}`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({
        title: 'Corrected Title',
        description: 'Corrected description.',
        price: 40,
        condition: 'Fair',
        isNegotiable: false,
        categoryId: category.id,
        options: ['Local pickup'],
      });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Corrected Title');
    expect(res.body.price).toBe(40);
  });

  it('records a before/after audit event when a moderator edits an item', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken, user: moderator } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(contributorToken, category.id);

    await request(app)
      .put(`/items/${item.id}`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({
        title: 'Corrected Title',
        description: 'Corrected description.',
        price: 40,
        condition: 'Fair',
        isNegotiable: false,
        categoryId: category.id,
        options: ['Local pickup'],
      });

    const edits = await prisma.itemEdit.findMany({ where: { itemId: item.id } });
    expect(edits).toHaveLength(1);
    expect(edits[0].actorId).toBe(moderator.id);
    expect(edits[0].before).toMatchObject({ title: 'Editable Item', price: 30 });
    expect(edits[0].after).toMatchObject({ title: 'Corrected Title', price: 40 });
  });

  it('rejects a contributor trying to edit an item', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(contributorToken, category.id);

    const res = await request(app)
      .put(`/items/${item.id}`)
      .set('Authorization', `Bearer ${contributorToken}`)
      .send({
        title: 'Hijacked',
        description: 'x',
        price: 1,
        condition: 'Fair',
        isNegotiable: false,
        categoryId: category.id,
        options: [],
      });

    expect(res.status).toBe(403);
  });

  it('lets a moderator delete any item', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(contributorToken, category.id);

    const res = await request(app)
      .delete(`/items/${item.id}`)
      .set('Authorization', `Bearer ${modToken}`);

    expect(res.status).toBe(204);
    const found = await prisma.item.findUnique({ where: { id: item.id } });
    expect(found).toBeNull();
  });

  it('rejects updating an item to reference a nonexistent categoryId with 400', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(contributorToken, category.id);

    const res = await request(app)
      .put(`/items/${item.id}`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({
        title: 'Corrected Title',
        description: 'Corrected description.',
        price: 40,
        condition: 'Fair',
        isNegotiable: false,
        categoryId: '00000000-0000-0000-0000-000000000000',
        options: [],
      });

    expect(res.status).toBe(400);
  });

  it('returns 404 when editing a non-existent item', async () => {
    const { token: modToken } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();

    const res = await request(app)
      .put('/items/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${modToken}`)
      .send({
        title: 'Ghost',
        description: 'x',
        price: 1,
        condition: 'Fair',
        isNegotiable: false,
        categoryId: category.id,
        options: [],
      });

    expect(res.status).toBe(404);
  });
});

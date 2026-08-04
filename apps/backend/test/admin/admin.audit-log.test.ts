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
    .field('description', 'For audit log tests.')
    .field('price', '20')
    .field('condition', 'Good')
    .field('isNegotiable', 'false')
    .field('categoryId', categoryId)
    .field('options', JSON.stringify([]))
    .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');
  return res.body;
}

describe('GET /admin/audit-log', () => {
  beforeEach(resetDb);

  it('merges status transitions and content edits into one chronological feed', async () => {
    const { token: contributorToken } = await registerAndLogin(app, 'CONTRIBUTOR');
    const { token: modToken, user: moderator } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();
    const item = await createItem(contributorToken, category.id, 'Audit Trail Item');

    await request(app).post(`/items/${item.id}/approve`).set('Authorization', `Bearer ${modToken}`);
    await request(app)
      .put(`/items/${item.id}`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({
        title: 'Audit Trail Item (edited)',
        description: 'Edited for audit log tests.',
        price: 25,
        condition: 'Good',
        isNegotiable: false,
        categoryId: category.id,
        options: [],
      });

    const res = await request(app).get('/admin/audit-log').set('Authorization', `Bearer ${modToken}`);

    expect(res.status).toBe(200);
    // create (system), approve (moderator), edit (moderator) = 3 events for this item
    const entriesForItem = res.body.filter((e: { itemId: string }) => e.itemId === item.id);
    expect(entriesForItem).toHaveLength(3);

    const types = entriesForItem.map((e: { type: string }) => e.type);
    expect(types).toContain('STATUS_CHANGE');
    expect(types).toContain('EDIT');

    const editEntry = entriesForItem.find((e: { type: string }) => e.type === 'EDIT');
    expect(editEntry.actorName).toBe(moderator.name);
    expect(editEntry.itemTitle).toBe('Audit Trail Item (edited)');
    expect(editEntry.before.title).toBe('Audit Trail Item');
    expect(editEntry.after.title).toBe('Audit Trail Item (edited)');

    // Newest first.
    const timestamps = res.body.map((e: { createdAt: string }) => new Date(e.createdAt).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  it('rejects a contributor with 403', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const res = await request(app).get('/admin/audit-log').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/admin/audit-log');
    expect(res.status).toBe(401);
  });
});

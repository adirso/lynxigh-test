import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createApp } from '../../src/app.js';
import { resetDb } from '../helpers/db-reset.js';
import { prisma } from '../../src/db.js';
import { registerAndLogin } from '../helpers/factories.js';
import { loadEnv } from '../../src/env.js';

const app = createApp();
const uploadsDir = path.resolve(loadEnv().uploadsDir);

function countUploadedFiles() {
  return existsSync(uploadsDir) ? readdirSync(uploadsDir).length : 0;
}

describe('POST /items', () => {
  beforeEach(resetDb);

  it('lets a contributor create a listing with a photo, entering pending review', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();

    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Solid Oak Bookshelf')
      .field('description', 'Five adjustable shelves, honey finish.')
      .field('price', '85')
      .field('condition', 'Like new')
      .field('isNegotiable', 'false')
      .field('categoryId', category.id)
      .field('options', JSON.stringify(['Local pickup']))
      .attach('photos', Buffer.from('fake-image-bytes'), 'bookshelf.jpg');

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.photos).toHaveLength(1);
    expect(res.body.photos[0].isPrimary).toBe(true);

    const events = await prisma.statusEvent.findMany({ where: { itemId: res.body.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ fromStatus: null, toStatus: 'PENDING' });
  });

  it('rejects a listing with no photos', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();

    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'No Photo Item')
      .field('description', 'Missing photos.')
      .field('price', '10')
      .field('condition', 'Good')
      .field('isNegotiable', 'false')
      .field('categoryId', category.id)
      .field('options', JSON.stringify([]));

    expect(res.status).toBe(400);
  });

  it('rejects isNegotiable=true without a minPrice', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();

    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Negotiable Item')
      .field('description', 'Needs a min price.')
      .field('price', '50')
      .field('condition', 'Good')
      .field('isNegotiable', 'true')
      .field('categoryId', category.id)
      .field('options', JSON.stringify([]))
      .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');

    expect(res.status).toBe(400);
  });

  it('rejects a moderator trying to create a listing', async () => {
    const { token } = await registerAndLogin(app, 'MODERATOR');
    const category = await prisma.category.findFirstOrThrow();

    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Not Allowed')
      .field('description', 'Moderators cannot create.')
      .field('price', '10')
      .field('condition', 'Good')
      .field('isNegotiable', 'false')
      .field('categoryId', category.id)
      .field('options', JSON.stringify([]))
      .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');

    expect(res.status).toBe(403);
  });

  it('rejects a well-formed but nonexistent categoryId with 400, before writing any photos to disk', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const before = countUploadedFiles();

    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Ghost Category Item')
      .field('description', 'References a category that does not exist.')
      .field('price', '10')
      .field('condition', 'Good')
      .field('isNegotiable', 'false')
      .field('categoryId', '00000000-0000-0000-0000-000000000000')
      .field('options', JSON.stringify([]))
      .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');

    expect(res.status).toBe(400);
    expect(countUploadedFiles()).toBe(before);

    const items = await prisma.item.findMany({ where: { title: 'Ghost Category Item' } });
    expect(items).toHaveLength(0);
  });

  it('rejects a non-image file upload (e.g. HTML) with 400', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();

    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Malicious Upload')
      .field('description', 'Tries to upload an HTML file as a photo.')
      .field('price', '10')
      .field('condition', 'Good')
      .field('isNegotiable', 'false')
      .field('categoryId', category.id)
      .field('options', JSON.stringify([]))
      .attach('photos', Buffer.from('<script>alert(1)</script>'), {
        filename: 'evil.html',
        contentType: 'text/html',
      });

    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON in the options field with 400 instead of 500', async () => {
    const { token } = await registerAndLogin(app, 'CONTRIBUTOR');
    const category = await prisma.category.findFirstOrThrow();

    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Broken Options')
      .field('description', 'options is not valid JSON.')
      .field('price', '10')
      .field('condition', 'Good')
      .field('isNegotiable', 'false')
      .field('categoryId', category.id)
      .field('options', '{not valid json')
      .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');

    expect(res.status).toBe(400);
  });

  it('rejects an unauthenticated request', async () => {
    const category = await prisma.category.findFirstOrThrow();
    const res = await request(app)
      .post('/items')
      .field('title', 'Anon Item')
      .field('description', 'No auth.')
      .field('price', '10')
      .field('condition', 'Good')
      .field('isNegotiable', 'false')
      .field('categoryId', category.id)
      .field('options', JSON.stringify([]))
      .attach('photos', Buffer.from('fake-image-bytes'), 'item.jpg');

    expect(res.status).toBe(401);
  });
});

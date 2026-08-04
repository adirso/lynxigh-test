import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDb } from '../helpers/db-reset.js';
import { prisma } from '../../src/db.js';
import { hashPassword } from '../../src/auth/password.js';

const app = createApp();

describe('POST /auth/register', () => {
  beforeEach(resetDb);

  it('creates a contributor and returns a token', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'jordan@example.com',
      password: 'super-secret-1',
      name: 'Jordan',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      email: 'jordan@example.com',
      name: 'Jordan',
      role: 'CONTRIBUTOR',
    });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/auth/register').send({
      email: 'dup@example.com',
      password: 'super-secret-1',
      name: 'First',
    });

    const res = await request(app).post('/auth/register').send({
      email: 'dup@example.com',
      password: 'another-secret',
      name: 'Second',
    });

    expect(res.status).toBe(409);
  });

  it('CRITICAL: ignores a client-supplied role and always creates a CONTRIBUTOR account, even if the body claims MODERATOR', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'attacker@example.com',
      password: 'super-secret-1',
      name: 'Attacker',
      role: 'MODERATOR',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('CONTRIBUTOR');

    const dbUser = await prisma.user.findUniqueOrThrow({ where: { email: 'attacker@example.com' } });
    expect(dbUser.role).toBe('CONTRIBUTOR');

    // The minted token must also carry CONTRIBUTOR, not the requested role.
    const meRes = await request(app)
      .get('/moderation/queue')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(meRes.status).toBe(403);
  });
});

describe('POST /auth/login', () => {
  beforeEach(resetDb);

  it('logs in with correct credentials and returns the account role from the DB', async () => {
    // Moderator accounts are provisioned out-of-band (never via public
    // register) — create one directly to prove login round-trips a
    // MODERATOR role correctly.
    const passwordHash = await hashPassword('super-secret-1');
    await prisma.user.create({
      data: { email: 'morgan@example.com', passwordHash, name: 'Morgan', role: 'MODERATOR' },
    });

    const res = await request(app).post('/auth/login').send({
      email: 'morgan@example.com',
      password: 'super-secret-1',
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.role).toBe('MODERATOR');
  });

  it('rejects the wrong password with 401', async () => {
    await request(app).post('/auth/register').send({
      email: 'morgan2@example.com',
      password: 'super-secret-1',
      name: 'Morgan',
    });

    const res = await request(app).post('/auth/login').send({
      email: 'morgan2@example.com',
      password: 'wrong-password',
    });

    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  beforeEach(resetDb);

  it("returns the caller's current details from the DB, not just the token payload", async () => {
    const registerRes = await request(app).post('/auth/register').send({
      email: 'me@example.com',
      password: 'super-secret-1',
      name: 'Original Name',
    });
    const token = registerRes.body.token as string;

    // Change the name directly in the DB, independent of anything the token
    // knows about — /me must reflect this, not the stale value from login.
    await prisma.user.update({ where: { email: 'me@example.com' }, data: { name: 'Updated Name' } });

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email: 'me@example.com',
      name: 'Updated Name',
      role: 'CONTRIBUTOR',
    });
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it("returns 401 when the token's user no longer exists in the DB", async () => {
    const registerRes = await request(app).post('/auth/register').send({
      email: 'gone@example.com',
      password: 'super-secret-1',
      name: 'Gone Soon',
    });
    const token = registerRes.body.token as string;

    await prisma.user.delete({ where: { email: 'gone@example.com' } });

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});

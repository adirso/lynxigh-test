import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDb } from '../helpers/db-reset.js';

const app = createApp();

describe('POST /auth/register', () => {
  beforeEach(resetDb);

  it('creates a contributor and returns a token', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'jordan@example.com',
      password: 'super-secret-1',
      name: 'Jordan',
      role: 'CONTRIBUTOR',
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
      role: 'CONTRIBUTOR',
    });

    const res = await request(app).post('/auth/register').send({
      email: 'dup@example.com',
      password: 'another-secret',
      name: 'Second',
      role: 'MODERATOR',
    });

    expect(res.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  beforeEach(resetDb);

  it('logs in with correct credentials', async () => {
    await request(app).post('/auth/register').send({
      email: 'morgan@example.com',
      password: 'super-secret-1',
      name: 'Morgan',
      role: 'MODERATOR',
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
      role: 'MODERATOR',
    });

    const res = await request(app).post('/auth/login').send({
      email: 'morgan2@example.com',
      password: 'wrong-password',
    });

    expect(res.status).toBe(401);
  });
});

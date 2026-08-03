import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Express } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../../src/db.js';
import { hashPassword } from '../../src/auth/password.js';
import { signAccessToken } from '../../src/auth/jwt.js';

/**
 * Creates a user directly via Prisma with an arbitrary role, bypassing the
 * public HTTP registration endpoint entirely (which — correctly — only ever
 * creates CONTRIBUTOR accounts, see src/auth/auth.service.ts). Tests have
 * direct DB access, unlike real clients, so this is the cleanest way to get a
 * MODERATOR test user without ever exercising a "trust the client's role"
 * code path, even in tests.
 */
export async function createUserWithRole(role: Role) {
  const email = `test-user-${randomUUID()}@example.com`;
  const passwordHash = await hashPassword('super-secret-1');
  const user = await prisma.user.create({
    data: { email, passwordHash, name: `Test ${role}`, role },
  });
  const token = signAccessToken({ sub: user.id, role: user.role });
  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

/**
 * Registers (or, for MODERATOR, directly provisions — see createUserWithRole
 * above) and returns a token + user for the given role. Uses a random UUID in
 * the email so parallel/repeated test runs never collide on a shared email,
 * independent of resetDb() ordering.
 */
export async function registerAndLogin(app: Express, role: Role) {
  if (role === 'MODERATOR') {
    return createUserWithRole(role);
  }

  const email = `test-user-${randomUUID()}@example.com`;
  const res = await request(app).post('/auth/register').send({
    email,
    password: 'super-secret-1',
    name: 'Test User',
  });
  return { token: res.body.token as string, user: res.body.user };
}

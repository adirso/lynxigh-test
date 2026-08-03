import request from 'supertest';
import type { Express } from 'express';
import type { Role } from '@prisma/client';

let counter = 0;

export async function registerAndLogin(app: Express, role: Role) {
  counter += 1;
  const email = `test-user-${counter}@example.com`;
  const res = await request(app).post('/auth/register').send({
    email,
    password: 'super-secret-1',
    name: `Test User ${counter}`,
    role,
  });
  return { token: res.body.token as string, user: res.body.user };
}

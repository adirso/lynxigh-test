import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signAccessToken, verifyAccessToken } from '../../src/auth/jwt.js';

describe('jwt', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'test-secret-key-for-jwt',
      JWT_EXPIRES_IN: '1h',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('round-trips a signed payload', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'CONTRIBUTOR' });
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('user-1');
    expect(decoded.role).toBe('CONTRIBUTOR');
  });

  it('throws on a garbage token', () => {
    expect(() => verifyAccessToken('not-a-real-token')).toThrow();
  });
});

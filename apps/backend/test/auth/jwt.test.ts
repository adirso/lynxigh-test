import { describe, it, expect } from 'vitest';
import { signAccessToken, verifyAccessToken } from '../../src/auth/jwt.js';

describe('jwt', () => {
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

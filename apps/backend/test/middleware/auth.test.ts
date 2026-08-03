import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requireAuth, requireRole, attachUserIfPresent } from '../../src/middleware/auth.js';
import { signAccessToken } from '../../src/auth/jwt.js';

function mockReqRes(headers: Record<string, string> = {}) {
  const req = { headers } as unknown as Request;
  const res = {} as Response;
  const next = vi.fn();
  return { req, res, next };
}

describe('requireAuth', () => {
  it('rejects a missing token with 401', () => {
    const { req, res, next } = mockReqRes();
    expect(() => requireAuth(req, res, next)).toThrow(expect.objectContaining({ statusCode: 401 }));
  });

  it('rejects an invalid token with 401', () => {
    const { req, res, next } = mockReqRes({ authorization: 'Bearer garbage' });
    expect(() => requireAuth(req, res, next)).toThrow(expect.objectContaining({ statusCode: 401 }));
  });

  it('attaches req.user and calls next for a valid token', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'MODERATOR' });
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });
    requireAuth(req, res, next);
    expect(req.user).toEqual({ id: 'user-1', role: 'MODERATOR' });
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('requireRole', () => {
  it('throws 403 when the role does not match', () => {
    const { req, res, next } = mockReqRes();
    req.user = { id: 'user-1', role: 'CONTRIBUTOR' };
    expect(() => requireRole('MODERATOR')(req, res, next)).toThrow(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it('calls next when the role matches', () => {
    const { req, res, next } = mockReqRes();
    req.user = { id: 'user-1', role: 'MODERATOR' };
    requireRole('MODERATOR')(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('attachUserIfPresent', () => {
  it('leaves req.user undefined and calls next when there is no token', () => {
    const { req, res, next } = mockReqRes();
    attachUserIfPresent(req, res, next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('attaches req.user when a valid token is present', () => {
    const token = signAccessToken({ sub: 'user-2', role: 'CONTRIBUTOR' });
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });
    attachUserIfPresent(req, res, next);
    expect(req.user).toEqual({ id: 'user-2', role: 'CONTRIBUTOR' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('leaves req.user undefined and calls next when an invalid token is present', () => {
    const { req, res, next } = mockReqRes({ authorization: 'Bearer garbage-token' });
    attachUserIfPresent(req, res, next);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('middleware chaining', () => {
  it('requireAuth followed by requireRole chains correctly and throws 403 for wrong role', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'CONTRIBUTOR' });
    const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });

    requireAuth(req, res, () => {
      expect(() => requireRole('MODERATOR')(req, res, next)).toThrow(
        expect.objectContaining({ statusCode: 403 }),
      );
    });
  });
});

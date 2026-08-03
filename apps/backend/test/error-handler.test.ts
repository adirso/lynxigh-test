import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { errorHandler } from '../src/middleware/error-handler.js';
import { NotFoundError, ValidationError } from '../src/errors.js';

function appWithRoute(handler: express.RequestHandler) {
  const app = express();
  app.get('/boom', handler);
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('converts AppError subclasses to their status code and message', async () => {
    const app = appWithRoute(() => {
      throw new NotFoundError('Item not found');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { message: 'Item not found' } });
  });

  it('converts a ValidationError to 400', async () => {
    const app = appWithRoute(() => {
      throw new ValidationError('Title is required');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { message: 'Title is required' } });
  });

  it('converts unknown errors to a generic 500 without leaking details', async () => {
    const app = appWithRoute(() => {
      throw new Error('unexpected db failure with connection string');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { message: 'Internal server error' } });
  });
});

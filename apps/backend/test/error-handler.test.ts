import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import multer from 'multer';
import { errorHandler } from '../src/middleware/error-handler.js';
import { NotFoundError, ValidationError, ServiceUnavailableError, BadGatewayError } from '../src/errors.js';

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

  it('converts a MulterError (e.g. file too large) to a clean 400 instead of a 500', async () => {
    const app = appWithRoute(() => {
      throw new multer.MulterError('LIMIT_FILE_SIZE');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { message: 'Invalid request' } });
  });

  it('honors an upstream 4xx status already set on a plain error (e.g. body-parser JSON SyntaxError) instead of forcing a 500', async () => {
    const app = appWithRoute(() => {
      const err = new SyntaxError('Unexpected token in JSON') as SyntaxError & { status: number; expose: boolean };
      err.status = 400;
      err.expose = true;
      throw err;
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { message: 'Invalid request' } });
  });

  it('does not honor a bogus non-4xx statusCode and still falls back to 500', async () => {
    const app = appWithRoute(() => {
      const err = new Error('weird upstream error') as Error & { statusCode: number };
      err.statusCode = 599;
      throw err;
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { message: 'Internal server error' } });
  });

  it('returns 400 for a real malformed JSON request body via express.json()', async () => {
    const jsonApp = express();
    jsonApp.use(express.json());
    jsonApp.post('/echo', (req, res) => res.json({ ok: true, body: req.body }));
    jsonApp.use(errorHandler);

    const res = await request(jsonApp)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{not valid json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { message: 'Invalid request' } });
  });

  it('converts a ServiceUnavailableError to 503', async () => {
    const app = appWithRoute(() => {
      throw new ServiceUnavailableError('AI description generation is not configured');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: { message: 'AI description generation is not configured' } });
  });

  it('converts a BadGatewayError to 502', async () => {
    const app = appWithRoute(() => {
      throw new BadGatewayError('AI description generation failed');
    });
    const res = await request(app).get('/boom');
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: { message: 'AI description generation failed' } });
  });
});

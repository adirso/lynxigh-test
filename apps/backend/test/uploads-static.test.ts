import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/env.js';

const uploadsDir = path.resolve(loadEnv().uploadsDir);

describe('GET /uploads/:file', () => {
  const jpgFilename = 'test-static-file.jpg';
  const htmlFilename = 'test-static-file.html';

  beforeAll(() => {
    mkdirSync(uploadsDir, { recursive: true });
    writeFileSync(path.join(uploadsDir, jpgFilename), Buffer.from('fake-image-bytes'));
    // Simulate a file that somehow ended up in the uploads dir with a
    // non-image extension (defense in depth — this should never happen given
    // the fileFilter + extension-from-mimetype fixes, but static serving
    // itself must not trust the extension either).
    writeFileSync(path.join(uploadsDir, htmlFilename), Buffer.from('<script>alert(1)</script>'));
  });

  afterAll(() => {
    rmSync(path.join(uploadsDir, jpgFilename), { force: true });
    rmSync(path.join(uploadsDir, htmlFilename), { force: true });
  });

  it('serves a .jpg with an image content type and a nosniff header', async () => {
    const app = createApp();
    const res = await request(app).get(`/uploads/${jpgFilename}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^image\/jpeg/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('never serves a .html file as text/html, even if one exists in the uploads dir', async () => {
    const app = createApp();
    const res = await request(app).get(`/uploads/${htmlFilename}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).not.toMatch(/html/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

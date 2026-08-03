import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { LocalDiskStorage } from '../../src/storage/local-disk-storage.js';

const TEST_DIR = path.resolve('./test-uploads-tmp');

describe('LocalDiskStorage', () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });
  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('saves a file to disk and returns a resolvable url', async () => {
    const storage = new LocalDiskStorage(TEST_DIR);
    const url = await storage.save({
      buffer: Buffer.from('fake-image-bytes'),
      originalName: 'photo.jpg',
      mimeType: 'image/jpeg',
    });

    expect(url).toMatch(/^\/uploads\/.+\.jpg$/);
    const savedPath = path.join(TEST_DIR, path.basename(url));
    expect(existsSync(savedPath)).toBe(true);
  });

  it('deletes a previously saved file', async () => {
    const storage = new LocalDiskStorage(TEST_DIR);
    const url = await storage.save({
      buffer: Buffer.from('fake-image-bytes'),
      originalName: 'photo.png',
      mimeType: 'image/png',
    });

    await storage.delete(url);

    const savedPath = path.join(TEST_DIR, path.basename(url));
    expect(existsSync(savedPath)).toBe(false);
  });
});

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { StoragePort, UploadedFile } from './storage-port.js';

export class LocalDiskStorage implements StoragePort {
  constructor(private readonly rootDir: string) {}

  async save(file: UploadedFile): Promise<string> {
    await mkdir(this.rootDir, { recursive: true });
    const ext = path.extname(file.originalName) || '';
    const filename = `${randomUUID()}${ext}`;
    await writeFile(path.join(this.rootDir, filename), file.buffer);
    return `/uploads/${filename}`;
  }

  async delete(url: string): Promise<void> {
    const filename = path.basename(url);
    await unlink(path.join(this.rootDir, filename)).catch((err) => {
      if (err.code !== 'ENOENT') throw err;
    });
  }
}

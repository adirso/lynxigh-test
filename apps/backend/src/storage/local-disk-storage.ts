import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { StoragePort, UploadedFile } from './storage-port.js';
import { ALLOWED_IMAGE_MIME_TYPES } from './mime-types.js';

export class LocalDiskStorage implements StoragePort {
  constructor(private readonly rootDir: string) {}

  async save(file: UploadedFile): Promise<string> {
    await mkdir(this.rootDir, { recursive: true });
    // Derive the on-disk extension from the validated MIME type, never from
    // the client-supplied originalName — a client could name a file
    // "photo.jpg" while uploading HTML/SVG, or vice versa. Anything not on
    // the allowlist (fileFilter should already have rejected it upstream)
    // falls back to a generic, inert extension.
    const ext = ALLOWED_IMAGE_MIME_TYPES[file.mimeType] ?? '.bin';
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

import type { Env } from '../env.js';
import { LocalDiskStorage } from './local-disk-storage.js';

export type UploadedFile = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
};

export interface StoragePort {
  save(file: UploadedFile): Promise<string>;
  delete(url: string): Promise<void>;
}

export function createStorage(env: Env): StoragePort {
  if (env.storageDriver === 'local') {
    return new LocalDiskStorage(env.uploadsDir);
  }
  throw new Error(`Unsupported STORAGE_DRIVER: ${env.storageDriver}`);
}

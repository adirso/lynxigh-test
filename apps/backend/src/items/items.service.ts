import { prisma } from '../db.js';
import { createStorage } from '../storage/storage-port.js';
import type { UploadedFile } from '../storage/storage-port.js';
import { loadEnv } from '../env.js';
import { serializeItem } from './items.serialize.js';
import type { CreateItemInput } from './items.schemas.js';

const storage = createStorage(loadEnv());

export async function createItem(contributorId: string, input: CreateItemInput, photos: UploadedFile[]) {
  const savedUrls = await Promise.all(photos.map((photo) => storage.save(photo)));

  const item = await prisma.item.create({
    data: {
      title: input.title,
      description: input.description,
      price: input.price,
      condition: input.condition,
      isNegotiable: input.isNegotiable,
      minPrice: input.minPrice ?? null,
      categoryId: input.categoryId,
      options: input.options,
      contributorId,
      status: 'PENDING',
      photos: {
        create: savedUrls.map((url, index) => ({
          url,
          position: index,
          isPrimary: index === 0,
        })),
      },
      statusEvents: {
        create: {
          actorId: contributorId,
          fromStatus: null,
          toStatus: 'PENDING',
        },
      },
    },
    include: { photos: true },
  });

  return serializeItem(item);
}

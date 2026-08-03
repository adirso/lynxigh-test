import type { Role, ItemStatus, Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { createStorage } from '../storage/storage-port.js';
import type { UploadedFile } from '../storage/storage-port.js';
import { loadEnv } from '../env.js';
import { serializeItem } from './items.serialize.js';
import type { CreateItemInput, UpdateItemInput } from './items.schemas.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../errors.js';

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

export type ItemFilters = {
  status?: ItemStatus;
  categoryId?: string;
  condition?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type Requester = { id: string; role: Role } | undefined;

export async function listItems(filters: ItemFilters, requester: Requester) {
  const isModerator = requester?.role === 'MODERATOR';
  const where: Prisma.ItemWhereInput = {
    status: isModerator && filters.status ? filters.status : 'PUBLISHED',
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.condition ? { condition: filters.condition } : {}),
    ...(filters.search ? { title: { contains: filters.search, mode: 'insensitive' } } : {}),
  };

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 24;

  const items = await prisma.item.findMany({
    where,
    include: { photos: true },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return items.map(serializeItem);
}

export async function getItemById(id: string, requester: Requester) {
  const item = await prisma.item.findUnique({ where: { id }, include: { photos: true } });
  if (!item) {
    throw new NotFoundError('Item not found');
  }

  const isOwner = requester?.id === item.contributorId;
  const isModerator = requester?.role === 'MODERATOR';
  if (item.status !== 'PUBLISHED' && !isOwner && !isModerator) {
    throw new NotFoundError('Item not found');
  }

  return serializeItem(item);
}

export async function cancelItem(id: string, requesterId: string) {
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) {
    throw new NotFoundError('Item not found');
  }
  if (item.contributorId !== requesterId) {
    throw new ForbiddenError('You can only cancel your own listings');
  }
  if (item.status !== 'PENDING' && item.status !== 'PUBLISHED') {
    throw new ConflictError(`Cannot cancel an item with status ${item.status}`);
  }

  const updated = await prisma.item.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      statusEvents: {
        create: { actorId: requesterId, fromStatus: item.status, toStatus: 'CANCELLED' },
      },
    },
    include: { photos: true },
  });

  return serializeItem(updated);
}

export async function updateItem(id: string, input: UpdateItemInput) {
  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Item not found');
  }

  const updated = await prisma.item.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      price: input.price,
      condition: input.condition,
      isNegotiable: input.isNegotiable,
      minPrice: input.minPrice ?? null,
      categoryId: input.categoryId,
      options: input.options,
    },
    include: { photos: true },
  });

  return serializeItem(updated);
}

export async function deleteItem(id: string) {
  const item = await prisma.item.findUnique({ where: { id }, include: { photos: true } });
  if (!item) {
    throw new NotFoundError('Item not found');
  }

  await Promise.all(item.photos.map((photo) => storage.delete(photo.url)));
  await prisma.item.delete({ where: { id } });
}

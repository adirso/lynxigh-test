import type { Role, ItemStatus, Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { createStorage } from '../storage/storage-port.js';
import type { UploadedFile } from '../storage/storage-port.js';
import { loadEnv } from '../env.js';
import { serializeItem, serializePrivilegedItem } from './items.serialize.js';
import type { CreateItemInput, UpdateItemInput } from './items.schemas.js';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../errors.js';

const storage = createStorage(loadEnv());

async function assertCategoryExists(categoryId: string): Promise<void> {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    throw new ValidationError('categoryId does not reference an existing category');
  }
}

export async function createItem(contributorId: string, input: CreateItemInput, photos: UploadedFile[]) {
  // Validate the category exists BEFORE writing any photos to disk. Photos
  // are written via storage.save() ahead of the Prisma create() below; if we
  // saved them first and only then hit a categoryId FK violation on create,
  // we'd have already wasted disk writes and left orphaned files behind.
  await assertCategoryExists(input.categoryId);

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

  // The contributor is always the owner of the item they just created.
  return serializePrivilegedItem(item);
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

// Privileged fields (minPrice, aiFlagged, aiFlagReason, aiConfidence) are only
// ever shown to the item's owner or a moderator — everyone else gets the
// public projection. Applied per-item here (rather than only in
// getItemById) so a moderator browsing /items?status=PENDING sees the same
// AI-flag hints they'd get from the dedicated moderation queue, and so a
// contributor listing items sees their own minPrice reflected back.
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

  return items.map((item) =>
    isModerator || item.contributorId === requester?.id
      ? serializePrivilegedItem(item)
      : serializeItem(item),
  );
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

  return isOwner || isModerator ? serializePrivilegedItem(item) : serializeItem(item);
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

  // Only the owning contributor can reach this (enforced above).
  return serializePrivilegedItem(updated);
}

export async function updateItem(id: string, input: UpdateItemInput) {
  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Item not found');
  }

  await assertCategoryExists(input.categoryId);

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

  // This route is moderator-only (requireRole('MODERATOR') in items.routes.ts).
  return serializePrivilegedItem(updated);
}

export async function deleteItem(id: string) {
  const item = await prisma.item.findUnique({ where: { id }, include: { photos: true } });
  if (!item) {
    throw new NotFoundError('Item not found');
  }

  await Promise.all(item.photos.map((photo) => storage.delete(photo.url)));
  await prisma.item.delete({ where: { id } });
}

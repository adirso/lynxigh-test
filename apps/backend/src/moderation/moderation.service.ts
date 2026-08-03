import { prisma } from '../db.js';
import { serializePrivilegedItem } from '../items/items.serialize.js';
import { NotFoundError, ConflictError } from '../errors.js';

export async function getQueue() {
  const items = await prisma.item.findMany({
    where: { status: 'PENDING' },
    include: { photos: true },
    orderBy: { createdAt: 'asc' },
  });
  return items.map(serializePrivilegedItem);
}

export async function approveItem(id: string, moderatorId: string) {
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) {
    throw new NotFoundError('Item not found');
  }
  if (item.status !== 'PENDING') {
    throw new ConflictError(`Cannot approve an item with status ${item.status}`);
  }

  const updated = await prisma.item.update({
    where: { id },
    data: {
      status: 'PUBLISHED',
      reviewedById: moderatorId,
      reviewedAt: new Date(),
      statusEvents: {
        create: { actorId: moderatorId, fromStatus: 'PENDING', toStatus: 'PUBLISHED' },
      },
    },
    include: { photos: true },
  });

  return serializePrivilegedItem(updated);
}

export async function rejectItem(id: string, moderatorId: string, reason: string) {
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) {
    throw new NotFoundError('Item not found');
  }
  if (item.status !== 'PENDING') {
    throw new ConflictError(`Cannot reject an item with status ${item.status}`);
  }

  const updated = await prisma.item.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedById: moderatorId,
      reviewedAt: new Date(),
      rejectionReason: reason,
      statusEvents: {
        create: { actorId: moderatorId, fromStatus: 'PENDING', toStatus: 'REJECTED', reason },
      },
    },
    include: { photos: true },
  });

  return serializePrivilegedItem(updated);
}

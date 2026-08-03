import type { Item, ItemPhoto } from '@prisma/client';

type SerializableItem = Item & { photos?: ItemPhoto[] };

function serializePhotos(item: SerializableItem) {
  return (item.photos ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((p) => ({ id: p.id, url: p.url, position: p.position, isPrimary: p.isPrimary }));
}

function serializeBase(item: SerializableItem) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    price: item.price.toNumber(),
    condition: item.condition,
    isNegotiable: item.isNegotiable,
    categoryId: item.categoryId,
    options: item.options,
    contributorId: item.contributorId,
    status: item.status,
    reviewedById: item.reviewedById,
    reviewedAt: item.reviewedAt,
    rejectionReason: item.rejectionReason,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    photos: serializePhotos(item),
  };
}

export type ItemDto = ReturnType<typeof serializeItem>;
export type PrivilegedItemDto = ReturnType<typeof serializePrivilegedItem>;

/**
 * Public projection — safe to return to anonymous browsers and to
 * contributors viewing items they don't own. Deliberately omits:
 *  - minPrice: the contributor's private negotiation floor
 *  - aiFlagged / aiFlagReason / aiConfidence: moderator-only screening hints
 */
export function serializeItem(item: SerializableItem) {
  return serializeBase(item);
}

/**
 * Privileged projection — for the item's owner (contributor) or a moderator
 * only. Adds the fields the public projection hides. Callers are responsible
 * for the authorization check (isOwner || isModerator) before choosing this
 * over serializeItem.
 */
export function serializePrivilegedItem(item: SerializableItem) {
  return {
    ...serializeBase(item),
    minPrice: item.minPrice ? item.minPrice.toNumber() : null,
    aiFlagged: item.aiFlagged,
    aiFlagReason: item.aiFlagReason,
    aiConfidence: item.aiConfidence ? item.aiConfidence.toNumber() : null,
  };
}

import type { Item, ItemPhoto } from '@prisma/client';

export type ItemDto = ReturnType<typeof serializeItem>;

export function serializeItem(item: Item & { photos?: ItemPhoto[] }) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    price: item.price.toNumber(),
    condition: item.condition,
    isNegotiable: item.isNegotiable,
    minPrice: item.minPrice ? item.minPrice.toNumber() : null,
    categoryId: item.categoryId,
    options: item.options,
    contributorId: item.contributorId,
    status: item.status,
    reviewedById: item.reviewedById,
    reviewedAt: item.reviewedAt,
    rejectionReason: item.rejectionReason,
    aiFlagged: item.aiFlagged,
    aiFlagReason: item.aiFlagReason,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    photos: (item.photos ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ id: p.id, url: p.url, position: p.position, isPrimary: p.isPrimary })),
  };
}

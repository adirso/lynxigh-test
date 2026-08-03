import { prisma } from '../db.js';

export async function listCategories() {
  return prisma.category.findMany({ orderBy: { name: 'asc' } });
}

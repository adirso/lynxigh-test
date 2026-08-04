import { prisma } from '../db.js';
import { ConflictError, NotFoundError } from '../errors.js';

export async function listCategories() {
  return prisma.category.findMany({ orderBy: { name: 'asc' } });
}

export async function createCategory(name: string) {
  const existing = await prisma.category.findUnique({ where: { name } });
  if (existing) {
    throw new ConflictError('A category with this name already exists');
  }
  return prisma.category.create({ data: { name } });
}

export async function renameCategory(id: string, name: string) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Category not found');
  }

  const nameTaken = await prisma.category.findUnique({ where: { name } });
  if (nameTaken && nameTaken.id !== id) {
    throw new ConflictError('A category with this name already exists');
  }

  return prisma.category.update({ where: { id }, data: { name } });
}

export async function deleteCategory(id: string) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Category not found');
  }

  const itemCount = await prisma.item.count({ where: { categoryId: id } });
  if (itemCount > 0) {
    throw new ConflictError('Cannot delete a category that still has items assigned to it');
  }

  await prisma.category.delete({ where: { id } });
}

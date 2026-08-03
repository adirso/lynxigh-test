import { prisma } from '../../src/db.js';
import { seedCategories } from '../../prisma/seed.js';

export async function resetDb() {
  await prisma.statusEvent.deleteMany();
  await prisma.itemPhoto.deleteMany();
  await prisma.item.deleteMany();
  await prisma.user.deleteMany();
  await seedCategories();
}

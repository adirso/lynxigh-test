import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const CATEGORY_NAMES = [
  'Electronics',
  'Furniture',
  'Clothing',
  'Vehicles',
  'Home & Garden',
  'Sports & Outdoors',
  'Toys & Games',
  'Other',
];

export async function seedCategories() {
  for (const name of CATEGORY_NAMES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedCategories()
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}

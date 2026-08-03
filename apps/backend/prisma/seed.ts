import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password.js';

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

// Public self-registration (POST /auth/register) only ever creates
// CONTRIBUTOR accounts — there is no way for a client to mint a MODERATOR
// account over HTTP. For local development/testing, seed a couple of demo
// moderator accounts out-of-band instead. Log in as one of these via
// POST /auth/login to exercise the moderator dashboard locally:
//
//   email: moderator@reloop.dev     password: moderator-demo-pw-1
//   email: moderator2@reloop.dev    password: moderator-demo-pw-1
//
// Do NOT reuse these credentials outside local development.
export const DEMO_MODERATORS = [
  { email: 'moderator@reloop.dev', password: 'moderator-demo-pw-1', name: 'Demo Moderator' },
  { email: 'moderator2@reloop.dev', password: 'moderator-demo-pw-1', name: 'Demo Moderator 2' },
];

export async function seedModerators() {
  for (const demo of DEMO_MODERATORS) {
    const passwordHash = await hashPassword(demo.password);
    await prisma.user.upsert({
      where: { email: demo.email },
      update: {},
      create: {
        email: demo.email,
        passwordHash,
        name: demo.name,
        role: 'MODERATOR',
      },
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedCategories()
    .then(() => seedModerators())
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}

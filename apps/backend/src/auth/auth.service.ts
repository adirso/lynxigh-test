import { prisma } from '../db.js';
import { hashPassword, verifyPassword } from './password.js';
import { signAccessToken } from './jwt.js';
import { ConflictError, UnauthorizedError } from '../errors.js';

export async function register(input: { email: string; password: string; name: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await hashPassword(input.password);
  // Public registration always creates a CONTRIBUTOR — never trust a
  // client-supplied role here. MODERATOR accounts are provisioned out-of-band
  // (see prisma/seed.ts for demo moderator credentials).
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      role: 'CONTRIBUTOR',
    },
  });

  const token = signAccessToken({ sub: user.id, role: user.role });
  return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}

export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = signAccessToken({ sub: user.id, role: user.role });
  return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}

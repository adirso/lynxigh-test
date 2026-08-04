import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../async-handler.js';
import { register, login, getCurrentUser } from './auth.service.js';
import { requireAuth } from '../middleware/auth.js';
import { ValidationError } from '../errors.js';

// Public self-registration only ever creates CONTRIBUTOR accounts. `role` is
// intentionally NOT accepted here — accepting a client-supplied role would let
// anyone mint a MODERATOR token and bypass every access control in the app.
// MODERATOR accounts are provisioned out-of-band (see prisma/seed.ts).
const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const authRouter = Router();

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }
    const result = await register(parsed.data);
    res.status(201).json(result);
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }
    const result = await login(parsed.data);
    res.status(200).json(result);
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req.user!.id);
    res.status(200).json(user);
  }),
);

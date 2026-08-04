import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../async-handler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ValidationError } from '../errors.js';
import { listCategories, createCategory, renameCategory, deleteCategory } from './categories.service.js';

const categoryNameSchema = z.object({ name: z.string().min(1) });

export const categoriesRouter = Router();

categoriesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const categories = await listCategories();
    res.json(categories);
  }),
);

categoriesRouter.post(
  '/',
  requireAuth,
  requireRole('MODERATOR'),
  asyncHandler(async (req, res) => {
    const parsed = categoryNameSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }
    const category = await createCategory(parsed.data.name);
    res.status(201).json(category);
  }),
);

categoriesRouter.put(
  '/:id',
  requireAuth,
  requireRole('MODERATOR'),
  asyncHandler(async (req, res) => {
    const parsed = categoryNameSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }
    const category = await renameCategory(req.params.id, parsed.data.name);
    res.json(category);
  }),
);

categoriesRouter.delete(
  '/:id',
  requireAuth,
  requireRole('MODERATOR'),
  asyncHandler(async (req, res) => {
    await deleteCategory(req.params.id);
    res.status(204).send();
  }),
);

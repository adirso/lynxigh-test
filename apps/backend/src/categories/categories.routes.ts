import { Router } from 'express';
import { asyncHandler } from '../async-handler.js';
import { listCategories } from './categories.service.js';

export const categoriesRouter = Router();

categoriesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const categories = await listCategories();
    res.json(categories);
  }),
);

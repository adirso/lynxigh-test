import { Router } from 'express';
import { asyncHandler } from '../async-handler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getQueue } from './moderation.service.js';

export const moderationRouter = Router();

moderationRouter.get(
  '/queue',
  requireAuth,
  requireRole('MODERATOR'),
  asyncHandler(async (_req, res) => {
    const items = await getQueue();
    res.json(items);
  }),
);

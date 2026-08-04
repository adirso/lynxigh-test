import { Router } from 'express';
import { asyncHandler } from '../async-handler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getAuditLog } from './admin.service.js';

export const adminRouter = Router();

adminRouter.get(
  '/audit-log',
  requireAuth,
  requireRole('MODERATOR'),
  asyncHandler(async (_req, res) => {
    const entries = await getAuditLog();
    res.json(entries);
  }),
);

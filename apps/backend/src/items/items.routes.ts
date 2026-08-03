import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../async-handler.js';
import { requireAuth, requireRole, attachUserIfPresent } from '../middleware/auth.js';
import { createItemBodySchema, updateItemBodySchema, listItemsQuerySchema } from './items.schemas.js';
import {
  createItem,
  listItems,
  listMyItems,
  getItemById,
  cancelItem,
  updateItem,
  deleteItem,
} from './items.service.js';
import { approveItem, rejectItem } from '../moderation/moderation.service.js';
import { ValidationError } from '../errors.js';
import { isAllowedImageMimeType } from '../storage/mime-types.js';

const rejectBodySchema = z.object({ reason: z.string().min(1) });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedImageMimeType(file.mimetype)) {
      cb(new ValidationError('Only JPEG, PNG, WEBP, and GIF photos are allowed'));
      return;
    }
    cb(null, true);
  },
});

export const itemsRouter = Router();

function parseMultipartBody(body: Record<string, string>) {
  let options: unknown = [];
  if (body.options) {
    try {
      options = JSON.parse(body.options);
    } catch {
      throw new ValidationError('options must be valid JSON');
    }
  }
  return {
    ...body,
    options,
  };
}

itemsRouter.post(
  '/',
  requireAuth,
  requireRole('CONTRIBUTOR'),
  upload.array('photos', 10),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) {
      throw new ValidationError('At least one photo is required');
    }

    const parsed = createItemBodySchema.safeParse(parseMultipartBody(req.body));
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }

    const item = await createItem(
      req.user!.id,
      parsed.data,
      files.map((f) => ({ buffer: f.buffer, originalName: f.originalname, mimeType: f.mimetype })),
    );
    res.status(201).json(item);
  }),
);

itemsRouter.get(
  '/',
  attachUserIfPresent,
  asyncHandler(async (req, res) => {
    const parsed = listItemsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }
    const items = await listItems(parsed.data, req.user);
    res.json(items);
  }),
);

// Must be registered before GET /:id — Express matches routes in order, and
// /:id would otherwise capture the literal path "mine" as an item id.
itemsRouter.get(
  '/mine',
  requireAuth,
  requireRole('CONTRIBUTOR'),
  asyncHandler(async (req, res) => {
    const items = await listMyItems(req.user!.id);
    res.json(items);
  }),
);

itemsRouter.get(
  '/:id',
  attachUserIfPresent,
  asyncHandler(async (req, res) => {
    const item = await getItemById(req.params.id, req.user);
    res.json(item);
  }),
);

itemsRouter.patch(
  '/:id/cancel',
  requireAuth,
  requireRole('CONTRIBUTOR'),
  asyncHandler(async (req, res) => {
    const item = await cancelItem(req.params.id, req.user!.id);
    res.json(item);
  }),
);

itemsRouter.put(
  '/:id',
  requireAuth,
  requireRole('MODERATOR'),
  asyncHandler(async (req, res) => {
    const parsed = updateItemBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }
    const item = await updateItem(req.params.id, parsed.data);
    res.json(item);
  }),
);

itemsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('MODERATOR'),
  asyncHandler(async (req, res) => {
    await deleteItem(req.params.id);
    res.status(204).send();
  }),
);

itemsRouter.post(
  '/:id/approve',
  requireAuth,
  requireRole('MODERATOR'),
  asyncHandler(async (req, res) => {
    const item = await approveItem(req.params.id, req.user!.id);
    res.json(item);
  }),
);

itemsRouter.post(
  '/:id/reject',
  requireAuth,
  requireRole('MODERATOR'),
  asyncHandler(async (req, res) => {
    const parsed = rejectBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }
    const item = await rejectItem(req.params.id, req.user!.id, parsed.data.reason);
    res.json(item);
  }),
);

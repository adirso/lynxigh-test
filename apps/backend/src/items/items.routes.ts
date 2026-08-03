import { Router } from 'express';
import multer from 'multer';
import type { ItemStatus } from '@prisma/client';
import { asyncHandler } from '../async-handler.js';
import { requireAuth, requireRole, attachUserIfPresent } from '../middleware/auth.js';
import { createItemBodySchema, updateItemBodySchema } from './items.schemas.js';
import { createItem, listItems, getItemById, cancelItem, updateItem, deleteItem } from './items.service.js';
import { ValidationError } from '../errors.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

export const itemsRouter = Router();

function parseMultipartBody(body: Record<string, string>) {
  return {
    ...body,
    options: body.options ? JSON.parse(body.options) : [],
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
    const { status, categoryId, condition, search, page, pageSize } = req.query;
    const items = await listItems(
      {
        status: typeof status === 'string' ? (status as ItemStatus) : undefined,
        categoryId: typeof categoryId === 'string' ? categoryId : undefined,
        condition: typeof condition === 'string' ? condition : undefined,
        search: typeof search === 'string' ? search : undefined,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      },
      req.user,
    );
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

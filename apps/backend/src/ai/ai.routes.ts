import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../async-handler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ValidationError, ServiceUnavailableError } from '../errors.js';
import { isAllowedImageMimeType } from '../storage/mime-types.js';
import { CONDITIONS, LISTING_OPTIONS } from '../items/items.constants.js';
import { isAiAvailable, generateDescription } from './ai.service.js';

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

const generateDescriptionBodySchema = z.object({
  title: z.string().default(''),
  categoryId: z.string().uuid().optional(),
  condition: z.enum(CONDITIONS),
  options: z.array(z.enum(LISTING_OPTIONS)).default([]),
});

function parseMultipartBody(body: Record<string, string>) {
  let options: unknown = [];
  if (body.options) {
    try {
      options = JSON.parse(body.options);
    } catch {
      throw new ValidationError('options must be valid JSON');
    }
  }
  return { ...body, options };
}

export const aiRouter = Router();

aiRouter.get(
  '/status',
  requireAuth,
  requireRole('CONTRIBUTOR'),
  asyncHandler(async (_req, res) => {
    res.json({ available: isAiAvailable() });
  }),
);

aiRouter.post(
  '/generate-description',
  requireAuth,
  requireRole('CONTRIBUTOR'),
  (req, _res, next) => {
    if (!isAiAvailable()) {
      next(new ServiceUnavailableError('AI description generation is not configured'));
      return;
    }
    next();
  },
  upload.array('photos', 10),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) {
      throw new ValidationError('At least one photo is required');
    }

    const parsed = generateDescriptionBodySchema.safeParse(parseMultipartBody(req.body));
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }

    const description = await generateDescription({
      title: parsed.data.title,
      categoryId: parsed.data.categoryId,
      condition: parsed.data.condition,
      options: parsed.data.options,
      photos: files.map((f) => ({ buffer: f.buffer, mimeType: f.mimetype })),
    });

    res.json({ description });
  }),
);

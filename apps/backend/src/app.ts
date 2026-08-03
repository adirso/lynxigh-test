import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { errorHandler } from './middleware/error-handler.js';
import { loadEnv } from './env.js';
import { authRouter } from './auth/auth.routes.js';
import { categoriesRouter } from './categories/categories.routes.js';
import { itemsRouter } from './items/items.routes.js';
import { moderationRouter } from './moderation/moderation.routes.js';
import { asyncHandler } from './async-handler.js';
import { ALLOWED_IMAGE_MIME_TYPES } from './storage/mime-types.js';

// Only the extensions LocalDiskStorage can actually produce (see
// storage/mime-types.ts) get a real Content-Type here; anything else falls
// back to application/octet-stream. Combined with the multer fileFilter and
// LocalDiskStorage deriving extensions from the validated MIME type (not the
// client-supplied filename), this ensures nothing in the uploads directory
// can ever be served as HTML/SVG/script content — defense in depth in case a
// stray non-image file ever ends up on disk.
const EXTENSION_CONTENT_TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(ALLOWED_IMAGE_MIME_TYPES).map(([mimeType, ext]) => [ext, mimeType]),
);

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const env = loadEnv();
  app.use(
    '/uploads',
    express.static(env.uploadsDir, {
      setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = EXTENSION_CONTENT_TYPES[ext] ?? 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    }),
  );

  app.get('/health', asyncHandler((_req, res) => {
    res.json({ status: 'ok' });
  }));

  app.use('/auth', authRouter);
  app.use('/categories', categoriesRouter);
  app.use('/items', itemsRouter);
  app.use('/moderation', moderationRouter);

  app.use(errorHandler);

  return app;
}

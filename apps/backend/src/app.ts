import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error-handler.js';
import { loadEnv } from './env.js';
import { authRouter } from './auth/auth.routes.js';
import { categoriesRouter } from './categories/categories.routes.js';
import { asyncHandler } from './async-handler.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const env = loadEnv();
  app.use('/uploads', express.static(env.uploadsDir));

  app.get('/health', asyncHandler((_req, res) => {
    res.json({ status: 'ok' });
  }));

  app.use('/auth', authRouter);
  app.use('/categories', categoriesRouter);

  app.use(errorHandler);

  return app;
}

import express, { type RequestHandler } from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error-handler.js';
import { loadEnv } from './env.js';

export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const env = loadEnv();
  app.use('/uploads', express.static(env.uploadsDir));

  app.get('/health', asyncHandler((_req, res) => {
    res.json({ status: 'ok' });
  }));

  app.use(errorHandler);

  return app;
}

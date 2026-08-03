import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../errors.js';

/**
 * Some upstream libraries (multer's own limit errors, express.json()'s
 * body-parser SyntaxError on malformed JSON) set `status` or `statusCode` to
 * a valid 4xx they've already determined, without throwing one of our
 * AppError subclasses. Recognize those and honor the status instead of
 * falling through to a generic 500 — but don't pass through the library's
 * raw message text, to avoid leaking internal details.
 */
function getUpstream4xxStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) {
    return undefined;
  }
  const status = (err as { status?: unknown }).status;
  const statusCode = (err as { statusCode?: unknown }).statusCode;
  const candidate = typeof status === 'number' ? status : typeof statusCode === 'number' ? statusCode : undefined;
  if (candidate !== undefined && candidate >= 400 && candidate < 500) {
    return candidate;
  }
  return undefined;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { message: err.message } });
    return;
  }

  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: { message: 'Invalid request' } });
    return;
  }

  const upstreamStatus = getUpstream4xxStatus(err);
  if (upstreamStatus !== undefined) {
    res.status(upstreamStatus).json({ error: { message: 'Invalid request' } });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { message: 'Internal server error' } });
};

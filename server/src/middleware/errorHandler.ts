import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config/index.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  // Safe logging without leaking internal credentials
  console.error('[ServerError]', err.message);

  // Return generic error message in production
  res.status(500).json({
    error: 'Internal server error',
    ...(config.nodeEnv === 'development' ? { message: err.message, stack: err.stack } : {}),
  });
}

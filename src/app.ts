// src/app.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import routes from './routes';
import { AppError } from './lib/errors';
import { ZodError } from 'zod';

const app = express();

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '25mb' }));

// Routes
app.get('/', (_req, res) => {
  res.send('OnlyZines API is running 🚀');
});
app.use('/api', routes);

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
  }

  if (err instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.errors,
      },
    });
  }

  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
});

export default app;

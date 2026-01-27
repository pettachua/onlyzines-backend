// src/lib/errors.ts

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  BadRequest: (message = 'Bad request') => new AppError(400, 'BAD_REQUEST', message),
  Unauthorized: (message = 'Unauthorized') => new AppError(401, 'UNAUTHORIZED', message),
  Forbidden: (message = 'Forbidden') => new AppError(403, 'FORBIDDEN', message),
  NotFound: (resource = 'Resource') => new AppError(404, 'NOT_FOUND', `${resource} not found`),
  Conflict: (message = 'Conflict') => new AppError(409, 'CONFLICT', message),
  ValidationError: (message = 'Validation failed') => new AppError(422, 'VALIDATION_ERROR', message),
  Internal: (message = 'Internal server error') => new AppError(500, 'INTERNAL_ERROR', message),
};

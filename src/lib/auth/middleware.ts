// src/lib/auth/middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from './jwt';
import { Errors } from '../errors';

export interface AuthenticatedRequest extends Request {
  user?: AccessTokenPayload;
}

export function extractAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = payload;
    }
  }

  next();
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(Errors.Unauthorized());
  }
  next();
}

export function getAuthUser(req: AuthenticatedRequest): AccessTokenPayload | undefined {
  return req.user;
}

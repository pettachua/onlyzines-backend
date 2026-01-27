// src/routes/auth.ts
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { Errors } from '../lib/errors';
import { hashPassword, verifyPassword } from '../lib/auth/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getAccessTokenExpirySeconds,
  getRefreshTokenExpiry,
} from '../lib/auth/jwt';
import { extractAuth, requireAuth, AuthenticatedRequest, getAuthUser } from '../lib/auth/middleware';

const router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const RefreshSchema = z.object({
  refreshToken: z.string(),
});

// ============================================================================
// HELPERS
// ============================================================================

async function createTokensForUser(user: { id: string; email: string }) {
  const tokenRecord = await prisma.refreshToken.create({
    data: {
      userId: user.id,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  const accessToken = generateAccessToken(user.id, user.email);
  const refreshToken = generateRefreshToken(user.id, tokenRecord.id);

  return { accessToken, refreshToken, expiresIn: getAccessTokenExpirySeconds() };
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /auth/signup
 */
router.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = SignupSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(409).json({
        error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' },
      });
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        displayName: data.displayName,
      },
    });

    const tokens = await createTokensForUser(user);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      tokens,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/login
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (!user) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    const validPassword = await verifyPassword(data.password, user.passwordHash);

    if (!validPassword) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    const tokens = await createTokensForUser(user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      tokens,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/refresh
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = RefreshSchema.parse(req.body);

    const payload = verifyRefreshToken(refreshToken);

    if (!payload) {
      return res.status(401).json({
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' },
      });
    }

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { id: payload.tokenId },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
      return res.status(401).json({
        error: { code: 'TOKEN_REVOKED', message: 'Token has been revoked or expired' },
      });
    }

    // Transaction: revoke old + create new atomically
    const newTokenRecord = await prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date() },
      });

      return tx.refreshToken.create({
        data: {
          userId: tokenRecord.userId,
          expiresAt: getRefreshTokenExpiry(),
        },
      });
    });

    const accessToken = generateAccessToken(tokenRecord.user.id, tokenRecord.user.email);
    const newRefreshToken = generateRefreshToken(tokenRecord.user.id, newTokenRecord.id);

    res.json({
      tokens: {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: getAccessTokenExpirySeconds(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/logout
 */
router.post('/logout', extractAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = getAuthUser(req);

    if (user) {
      await prisma.refreshToken.updateMany({
        where: { userId: user.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/me
 */
router.get('/me', extractAuth, requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) throw Errors.Unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw Errors.NotFound('User');
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;

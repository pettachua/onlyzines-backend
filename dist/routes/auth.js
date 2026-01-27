"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/auth.ts
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../lib/errors");
const password_1 = require("../lib/auth/password");
const jwt_1 = require("../lib/auth/jwt");
const middleware_1 = require("../lib/auth/middleware");
const router = (0, express_1.Router)();
// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================
const SignupSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    displayName: zod_1.z.string().min(1).max(100).optional(),
});
const LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
const RefreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string(),
});
// ============================================================================
// HELPERS
// ============================================================================
async function createTokensForUser(user) {
    const tokenRecord = await prisma_1.prisma.refreshToken.create({
        data: {
            userId: user.id,
            expiresAt: (0, jwt_1.getRefreshTokenExpiry)(),
        },
    });
    const accessToken = (0, jwt_1.generateAccessToken)(user.id, user.email);
    const refreshToken = (0, jwt_1.generateRefreshToken)(user.id, tokenRecord.id);
    return { accessToken, refreshToken, expiresIn: (0, jwt_1.getAccessTokenExpirySeconds)() };
}
// ============================================================================
// ROUTES
// ============================================================================
/**
 * POST /auth/signup
 */
router.post('/signup', async (req, res, next) => {
    try {
        const data = SignupSchema.parse(req.body);
        const existingUser = await prisma_1.prisma.user.findUnique({
            where: { email: data.email.toLowerCase() },
        });
        if (existingUser) {
            return res.status(409).json({
                error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' },
            });
        }
        const passwordHash = await (0, password_1.hashPassword)(data.password);
        const user = await prisma_1.prisma.user.create({
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
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /auth/login
 */
router.post('/login', async (req, res, next) => {
    try {
        const data = LoginSchema.parse(req.body);
        const user = await prisma_1.prisma.user.findUnique({
            where: { email: data.email.toLowerCase() },
        });
        if (!user) {
            return res.status(401).json({
                error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
            });
        }
        const validPassword = await (0, password_1.verifyPassword)(data.password, user.passwordHash);
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
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /auth/refresh
 */
router.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = RefreshSchema.parse(req.body);
        const payload = (0, jwt_1.verifyRefreshToken)(refreshToken);
        if (!payload) {
            return res.status(401).json({
                error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' },
            });
        }
        const tokenRecord = await prisma_1.prisma.refreshToken.findUnique({
            where: { id: payload.tokenId },
            include: { user: true },
        });
        if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
            return res.status(401).json({
                error: { code: 'TOKEN_REVOKED', message: 'Token has been revoked or expired' },
            });
        }
        // Transaction: revoke old + create new atomically
        const newTokenRecord = await prisma_1.prisma.$transaction(async (tx) => {
            await tx.refreshToken.update({
                where: { id: tokenRecord.id },
                data: { revokedAt: new Date() },
            });
            return tx.refreshToken.create({
                data: {
                    userId: tokenRecord.userId,
                    expiresAt: (0, jwt_1.getRefreshTokenExpiry)(),
                },
            });
        });
        const accessToken = (0, jwt_1.generateAccessToken)(tokenRecord.user.id, tokenRecord.user.email);
        const newRefreshToken = (0, jwt_1.generateRefreshToken)(tokenRecord.user.id, newTokenRecord.id);
        res.json({
            tokens: {
                accessToken,
                refreshToken: newRefreshToken,
                expiresIn: (0, jwt_1.getAccessTokenExpirySeconds)(),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /auth/logout
 */
router.post('/logout', middleware_1.extractAuth, async (req, res, next) => {
    try {
        const user = (0, middleware_1.getAuthUser)(req);
        if (user) {
            await prisma_1.prisma.refreshToken.updateMany({
                where: { userId: user.userId, revokedAt: null },
                data: { revokedAt: new Date() },
            });
        }
        res.json({ success: true });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /auth/me
 */
router.get('/me', middleware_1.extractAuth, middleware_1.requireAuth, async (req, res, next) => {
    try {
        const authUser = (0, middleware_1.getAuthUser)(req);
        if (!authUser)
            throw errors_1.Errors.Unauthorized();
        const user = await prisma_1.prisma.user.findUnique({
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
            throw errors_1.Errors.NotFound('User');
        }
        res.json({ user });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map
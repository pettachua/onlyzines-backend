"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.getAccessTokenExpirySeconds = getAccessTokenExpirySeconds;
exports.getRefreshTokenExpiry = getRefreshTokenExpiry;
// src/lib/auth/jwt.ts
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const ACCESS_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '7d';
function generateAccessToken(userId, email) {
    return jsonwebtoken_1.default.sign({ userId, email }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
}
function generateRefreshToken(userId, tokenId) {
    return jsonwebtoken_1.default.sign({ userId, tokenId }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}
function verifyAccessToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, ACCESS_SECRET);
    }
    catch {
        return null;
    }
}
function verifyRefreshToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, REFRESH_SECRET);
    }
    catch {
        return null;
    }
}
function getAccessTokenExpirySeconds() {
    return 15 * 60; // 15 minutes
}
function getRefreshTokenExpiry() {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
}
//# sourceMappingURL=jwt.js.map
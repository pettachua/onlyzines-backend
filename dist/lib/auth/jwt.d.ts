export interface AccessTokenPayload {
    userId: string;
    email: string;
}
export interface RefreshTokenPayload {
    userId: string;
    tokenId: string;
}
export declare function generateAccessToken(userId: string, email: string): string;
export declare function generateRefreshToken(userId: string, tokenId: string): string;
export declare function verifyAccessToken(token: string): AccessTokenPayload | null;
export declare function verifyRefreshToken(token: string): RefreshTokenPayload | null;
export declare function getAccessTokenExpirySeconds(): number;
export declare function getRefreshTokenExpiry(): Date;
//# sourceMappingURL=jwt.d.ts.map
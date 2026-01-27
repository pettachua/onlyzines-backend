import { Request, Response, NextFunction } from 'express';
import { AccessTokenPayload } from './jwt';
export interface AuthenticatedRequest extends Request {
    user?: AccessTokenPayload;
}
export declare function extractAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void;
export declare function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void;
export declare function getAuthUser(req: AuthenticatedRequest): AccessTokenPayload | undefined;
//# sourceMappingURL=middleware.d.ts.map
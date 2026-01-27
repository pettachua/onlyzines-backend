"use strict";
// src/lib/errors.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.Errors = exports.AppError = void 0;
class AppError extends Error {
    statusCode;
    code;
    constructor(statusCode, code, message) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
exports.Errors = {
    BadRequest: (message = 'Bad request') => new AppError(400, 'BAD_REQUEST', message),
    Unauthorized: (message = 'Unauthorized') => new AppError(401, 'UNAUTHORIZED', message),
    Forbidden: (message = 'Forbidden') => new AppError(403, 'FORBIDDEN', message),
    NotFound: (resource = 'Resource') => new AppError(404, 'NOT_FOUND', `${resource} not found`),
    Conflict: (message = 'Conflict') => new AppError(409, 'CONFLICT', message),
    ValidationError: (message = 'Validation failed') => new AppError(422, 'VALIDATION_ERROR', message),
    Internal: (message = 'Internal server error') => new AppError(500, 'INTERNAL_ERROR', message),
};
//# sourceMappingURL=errors.js.map
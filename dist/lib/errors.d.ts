export declare class AppError extends Error {
    statusCode: number;
    code: string;
    constructor(statusCode: number, code: string, message: string);
}
export declare const Errors: {
    BadRequest: (message?: string) => AppError;
    Unauthorized: (message?: string) => AppError;
    Forbidden: (message?: string) => AppError;
    NotFound: (resource?: string) => AppError;
    Conflict: (message?: string) => AppError;
    ValidationError: (message?: string) => AppError;
    Internal: (message?: string) => AppError;
};
//# sourceMappingURL=errors.d.ts.map
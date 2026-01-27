"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/app.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./routes"));
const errors_1 = require("./lib/errors");
const zod_1 = require("zod");
const app = (0, express_1.default)();
// CORS
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
}));
// Body parsing
app.use(express_1.default.json({ limit: '25mb' }));
// Routes
app.use('/api', routes_1.default);
// Error handler
app.use((err, _req, res, _next) => {
    console.error('Error:', err);
    if (err instanceof errors_1.AppError) {
        return res.status(err.statusCode).json({
            error: { code: err.code, message: err.message },
        });
    }
    if (err instanceof zod_1.ZodError) {
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
exports.default = app;
//# sourceMappingURL=app.js.map
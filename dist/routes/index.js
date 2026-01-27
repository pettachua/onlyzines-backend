"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/index.ts
const express_1 = require("express");
const auth_1 = __importDefault(require("./auth"));
const publisher_1 = __importDefault(require("./publisher"));
const router = (0, express_1.Router)();
router.use('/auth', auth_1.default);
router.use('/publisher', publisher_1.default);
// Health check
router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
exports.default = router;
//# sourceMappingURL=index.js.map
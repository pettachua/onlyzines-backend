"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAuth = extractAuth;
exports.requireAuth = requireAuth;
exports.getAuthUser = getAuthUser;
const jwt_1 = require("./jwt");
const errors_1 = require("../errors");
function extractAuth(req, _res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const payload = (0, jwt_1.verifyAccessToken)(token);
        if (payload) {
            req.user = payload;
        }
    }
    next();
}
function requireAuth(req, _res, next) {
    if (!req.user) {
        return next(errors_1.Errors.Unauthorized());
    }
    next();
}
function getAuthUser(req) {
    return req.user;
}
//# sourceMappingURL=middleware.js.map
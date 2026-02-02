"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitMiddleware = exports.paymentLimiter = exports.authLimiter = exports.streamingLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// General API rate limit - 100 requests per 15 minutes per IP
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Don't rate limit health checks
        return req.path === '/health';
    }
});
// Streaming rate limit - Higher limit for streaming
exports.streamingLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: 'Too many streaming requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});
// Auth rate limit - Stricter limit for auth endpoints (prevent brute force)
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Don't rate limit GET requests (like token validation)
        return req.method === 'GET';
    }
});
// Payment rate limit - Moderate limit for payment endpoints
exports.paymentLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute window
    max: 10,
    message: 'Too many payment requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});
exports.rateLimitMiddleware = {
    api: exports.apiLimiter,
    streaming: exports.streamingLimiter,
    auth: exports.authLimiter,
    payment: exports.paymentLimiter
};
//# sourceMappingURL=rate-limit.middleware.js.map
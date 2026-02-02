"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_http_proxy_1 = __importDefault(require("express-http-proxy"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const rate_limit_middleware_1 = require("../middleware/rate-limit.middleware");
const request_logger_middleware_1 = require("../middleware/request-logger.middleware");
const router = (0, express_1.Router)();
// Helper function to forward paths
const createForwardPath = (servicePrefix) => (req) => `${servicePrefix}${req.url}`;
// Auth Service - No authentication required
router.use('/auth', request_logger_middleware_1.requestLogger, (0, express_http_proxy_1.default)(process.env.AUTH_SERVICE_URL || 'http://localhost:3001', {
    changeOrigin: true,
    forwardPath: createForwardPath('/api/auth')
}));
// User Service - Authentication required
router.use('/users', auth_middleware_1.authMiddleware, rate_limit_middleware_1.rateLimitMiddleware.api, request_logger_middleware_1.requestLogger, (0, express_http_proxy_1.default)(process.env.USER_SERVICE_URL || 'http://localhost:3002', {
    changeOrigin: true,
    forwardPath: createForwardPath('/api/users')
}));
// Content Service - Authentication optional
router.use('/content', request_logger_middleware_1.requestLogger, (0, express_http_proxy_1.default)(process.env.CONTENT_SERVICE_URL || 'http://localhost:3003', {
    changeOrigin: true,
    forwardPath: createForwardPath('/api/content')
}));
// Streaming Service - Authentication required
router.use('/stream', auth_middleware_1.authMiddleware, rate_limit_middleware_1.rateLimitMiddleware.streaming, request_logger_middleware_1.requestLogger, (0, express_http_proxy_1.default)(process.env.STREAMING_SERVICE_URL || 'http://localhost:3004', {
    changeOrigin: true,
    forwardPath: createForwardPath('/api/stream')
}));
// Payment Service - Authentication required
router.use('/payments', auth_middleware_1.authMiddleware, rate_limit_middleware_1.rateLimitMiddleware.api, request_logger_middleware_1.requestLogger, (0, express_http_proxy_1.default)(process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005', {
    changeOrigin: true,
    forwardPath: createForwardPath('/api/payments')
}));
// Notification Service - Authentication required
router.use('/notifications', auth_middleware_1.authMiddleware, rate_limit_middleware_1.rateLimitMiddleware.api, request_logger_middleware_1.requestLogger, (0, express_http_proxy_1.default)(process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006', {
    changeOrigin: true,
    forwardPath: createForwardPath('/api/notifications')
}));
// Analytics Service - Authentication required
router.use('/analytics', auth_middleware_1.authMiddleware, rate_limit_middleware_1.rateLimitMiddleware.api, request_logger_middleware_1.requestLogger, (0, express_http_proxy_1.default)(process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3007', {
    changeOrigin: true,
    forwardPath: createForwardPath('/api/analytics')
}));
exports.default = router;
//# sourceMappingURL=gateway.routes.js.map
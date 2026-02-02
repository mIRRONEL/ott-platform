"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const logger_1 = require("../utils/logger");
const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    // Add request ID to response headers
    res.setHeader('X-Request-ID', requestId);
    // Log incoming request
    logger_1.logger.info(`[${requestId}] Incoming request`, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: req.user?.userId || 'anonymous'
    });
    // Capture response
    const originalSend = res.send;
    res.send = function (data) {
        const duration = Date.now() - startTime;
        // Log outgoing response
        logger_1.logger.info(`[${requestId}] Outgoing response`, {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userId: req.user?.userId || 'anonymous'
        });
        // Call original send
        return originalSend.call(this, data);
    };
    next();
};
exports.requestLogger = requestLogger;
const generateRequestId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
//# sourceMappingURL=request-logger.middleware.js.map
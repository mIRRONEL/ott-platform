"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const error_handler_1 = require("./middleware/error.handler");
const logger_1 = require("./utils/logger");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3005;
// Trust proxy
app.set('trust proxy', 1);
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.'
});
// Strict rate limiting for payment endpoints
const paymentLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true
});
app.use(limiter);
// Body parser middleware
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Request logging middleware
app.use((req, res, next) => {
    logger_1.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    next();
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        service: 'payment-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
// API routes
app.use('/api/payments', paymentLimiter, payment_routes_1.default);
// Webhook route (bypass rate limiting for Stripe)
app.post('/webhooks/stripe', express_1.default.raw({ type: 'application/json' }), (req, res, next) => {
    // This is a placeholder - actual webhook handling would be in the routes
    logger_1.logger.info('Stripe webhook received');
    res.status(200).json({ received: true });
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: `Route ${req.path} not found`,
        code: 'NOT_FOUND'
    });
});
// Global error handler
app.use(error_handler_1.errorHandler);
// Graceful shutdown
const gracefulShutdown = () => {
    logger_1.logger.info('Received shutdown signal, closing gracefully...');
    process.exit(0);
};
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
// Start server
const server = app.listen(PORT, () => {
    logger_1.logger.info(`🚀 Payment Service running on port ${PORT}`);
});
process.on('unhandledRejection', (err) => {
    logger_1.logger.error('Unhandled Rejection:', err);
    process.exit(1);
});
exports.default = app;
//# sourceMappingURL=index.js.map
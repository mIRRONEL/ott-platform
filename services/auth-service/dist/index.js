"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const logger_1 = require("./utils/logger");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const error_handler_1 = require("./middleware/error.handler");
const connection_1 = require("./database/connection");
const producer_1 = require("./kafka/producer");
const redis_1 = require("./config/redis");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// =============================================
// MIDDLEWARE
// =============================================
// Security middleware
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: false
}));
app.use((0, cors_1.default)({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);
// Body parser
app.use(express_1.default.json({ limit: '10kb' }));
app.use(express_1.default.urlencoded({ limit: '10kb', extended: true }));
// Logging middleware
app.use((req, res, next) => {
    logger_1.logger.info({
        method: req.method,
        path: req.path,
        ip: req.ip,
        timestamp: new Date().toISOString()
    });
    next();
});
// =============================================
// ROUTES
// =============================================
app.use('/api/auth', auth_routes_1.default);
// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'auth-service',
        timestamp: new Date().toISOString()
    });
});
// =============================================
// ERROR HANDLING
// =============================================
app.use(error_handler_1.errorHandler);
// =============================================
// SERVER STARTUP
// =============================================
async function startServer() {
    try {
        // Connect to PostgreSQL
        await (0, connection_1.connectDatabase)();
        logger_1.logger.info('✓ PostgreSQL connected');
        // Connect to Redis (non-blocking)
        (0, redis_1.connectRedis)()
            .then(() => {
            logger_1.logger.info('✓ Redis connected');
        })
            .catch((error) => {
            logger_1.logger.warn('Redis connection failed, will continue without cache...', error);
        });
        // Connect to Kafka (non-blocking)
        (0, producer_1.connectKafka)()
            .then(() => {
            logger_1.logger.info('✓ Kafka connected');
        })
            .catch((error) => {
            logger_1.logger.warn('Kafka connection failed, will retry...', error);
        });
        // Start server
        app.listen(PORT, () => {
            logger_1.logger.info(`🚀 Auth Service running on port ${PORT}`);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server', error);
        process.exit(1);
    }
}
// Handle graceful shutdown
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});
process.on('SIGINT', () => {
    logger_1.logger.info('SIGINT signal received: closing HTTP server');
    process.exit(0);
});
// Handle uncaught rejections
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught Exception:', error);
    process.exit(1);
});
startServer();
exports.default = app;
//# sourceMappingURL=index.js.map
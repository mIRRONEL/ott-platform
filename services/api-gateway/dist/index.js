"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const gateway_routes_1 = __importDefault(require("./routes/gateway.routes"));
const error_handler_1 = require("./middleware/error.handler");
const rate_limit_middleware_1 = require("./middleware/rate-limit.middleware");
const logger_1 = require("./utils/logger");
const service_discovery_1 = require("./services/service-discovery");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.set('trust proxy', 1);
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(rate_limit_middleware_1.rateLimitMiddleware.api);
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Request logging
app.use((req, res, next) => {
    logger_1.logger.debug(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    next();
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        service: 'api-gateway',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
// Service status endpoint
app.get('/status', (req, res) => {
    const status = (0, service_discovery_1.getServiceStatus)();
    res.status(200).json(status);
});
// API Routes
app.use('/api/v1', gateway_routes_1.default);
app.use('/api', gateway_routes_1.default); // Also support /api without v1 for backwards compatibility
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Endpoint not found',
        statusCode: 404,
        path: req.path
    });
});
// Error handler
app.use(error_handler_1.errorHandler);
// Graceful shutdown
const gracefulShutdown = (signal) => {
    logger_1.logger.info(`Received ${signal}, starting graceful shutdown...`);
    process.exit(0);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// Start server
const startServer = () => {
    try {
        // Initialize service discovery
        (0, service_discovery_1.initializeServiceRegistry)();
        app.listen(PORT, () => {
            logger_1.logger.info(`API Gateway listening on port ${PORT}`);
            logger_1.logger.info('Service discovery initialized');
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
exports.default = app;
//# sourceMappingURL=index.js.map
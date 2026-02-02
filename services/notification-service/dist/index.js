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
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const error_handler_1 = require("./middleware/error.handler");
const logger_1 = require("./utils/logger");
const consumer_1 = require("./kafka/consumer");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3006;
app.set('trust proxy', 1);
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.'
});
app.use(limiter);
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((req, res, next) => {
    logger_1.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    next();
});
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        service: 'notification-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
app.use('/api/notifications', notification_routes_1.default);
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: `Route ${req.path} not found`,
        code: 'NOT_FOUND'
    });
});
app.use(error_handler_1.errorHandler);
const gracefulShutdown = () => {
    logger_1.logger.info('Received shutdown signal, closing gracefully...');
    process.exit(0);
};
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
// Initialize Kafka consumer
(0, consumer_1.initializeKafkaConsumer)().catch(err => {
    logger_1.logger.error('Failed to initialize Kafka consumer:', err);
    process.exit(1);
});
const server = app.listen(PORT, () => {
    logger_1.logger.info(`🚀 Notification Service running on port ${PORT}`);
});
process.on('unhandledRejection', (err) => {
    logger_1.logger.error('Unhandled Rejection:', err);
    process.exit(1);
});
exports.default = app;
//# sourceMappingURL=index.js.map
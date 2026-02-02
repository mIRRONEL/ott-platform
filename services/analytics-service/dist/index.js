"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const analytics_routes_1 = __importDefault(require("./routes/analytics.routes"));
const error_handler_1 = require("./middleware/error.handler");
const logger_1 = require("./utils/logger");
const consumer_1 = require("./kafka/consumer");
const mongodb_connection_1 = require("./database/mongodb.connection");
const connection_1 = require("./database/connection");
const analyticsService = __importStar(require("./services/analytics.service"));
const recommendationService = __importStar(require("./services/recommendation.service"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3007;
// Middleware
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
// Logging middleware
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
        service: 'analytics-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
// Routes
app.use('/api/v1/analytics', analytics_routes_1.default);
// Error handler
app.use(error_handler_1.errorHandler);
// Graceful shutdown
const gracefulShutdown = async (signal) => {
    logger_1.logger.info(`Received ${signal}, starting graceful shutdown...`);
    try {
        await (0, consumer_1.stopKafkaConsumer)();
        await (0, connection_1.closePgConnection)();
        await (0, mongodb_connection_1.closeMongoDBConnection)();
        logger_1.logger.info('All connections closed');
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('Error during shutdown:', error);
        process.exit(1);
    }
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// Start server
const startServer = async () => {
    try {
        // Connect to databases
        const db = await (0, mongodb_connection_1.connectMongoDB)();
        analyticsService.setDatabases(connection_1.pgPool, db);
        recommendationService.setDatabases(connection_1.pgPool, db);
        // Initialize Kafka consumer
        await (0, consumer_1.initializeKafkaConsumer)();
        app.listen(PORT, () => {
            logger_1.logger.info(`Analytics service listening on port ${PORT}`);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
//# sourceMappingURL=index.js.map
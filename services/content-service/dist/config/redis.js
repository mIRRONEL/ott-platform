"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeRedisConnection = exports.redisClient = void 0;
const redis_1 = require("redis");
;
const logger_1 = require("../utils/logger");
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
exports.redisClient = (0, redis_1.createClient)({
    url: redisUrl,
    socket: {
        reconnectStrategy: (retries) => {
            const delay = Math.min(retries * 50, 2000);
            return delay;
        }
    }
});
exports.redisClient.on('error', (err) => {
    logger_1.logger.error('Redis error:', err);
});
exports.redisClient.on('connect', () => {
    logger_1.logger.info('Redis connected');
});
exports.redisClient.on('reconnecting', () => {
    logger_1.logger.warn('Redis reconnecting');
});
// Connect to Redis with retry
const connectRedis = () => {
    exports.redisClient.connect()
        .catch((err) => {
        logger_1.logger.warn('Redis connection failed, will retry in 5s...', err);
        setTimeout(connectRedis, 5000);
    });
};
connectRedis();
const closeRedisConnection = async () => {
    await exports.redisClient.quit();
    logger_1.logger.info('Redis connection closed');
};
exports.closeRedisConnection = closeRedisConnection;
//# sourceMappingURL=redis.js.map
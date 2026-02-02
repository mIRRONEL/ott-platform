"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRedisConnected = exports.getRedisClient = exports.connectRedis = void 0;
const redis_1 = require("redis");
const logger_1 = require("../utils/logger");
let redisClient = null;
let isConnected = false;
const initializeRedis = () => {
    if (redisClient)
        return redisClient;
    redisClient = (0, redis_1.createClient)({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        socket: {
            reconnectStrategy: (retries) => {
                if (retries > 10) {
                    logger_1.logger.error('Redis reconnection failed after 10 attempts');
                    return new Error('Redis max retries exceeded');
                }
                return retries * 50;
            }
        }
    });
    redisClient.on('error', (err) => {
        isConnected = false;
        logger_1.logger.warn('Redis error:', err);
    });
    redisClient.on('connect', () => {
        isConnected = true;
        logger_1.logger.info('Redis connected');
    });
    redisClient.on('reconnecting', () => {
        logger_1.logger.info('Redis reconnecting...');
    });
    return redisClient;
};
const connectRedis = async () => {
    try {
        const client = initializeRedis();
        if (client && !isConnected) {
            await client.connect();
            isConnected = true;
            logger_1.logger.info('Redis connected successfully');
        }
    }
    catch (error) {
        isConnected = false;
        logger_1.logger.warn('Redis connection failed, cache operations will be unavailable:', error);
    }
};
exports.connectRedis = connectRedis;
const getRedisClient = () => {
    if (!redisClient) {
        initializeRedis();
    }
    return redisClient;
};
exports.getRedisClient = getRedisClient;
const isRedisConnected = () => {
    return isConnected && redisClient !== null;
};
exports.isRedisConnected = isRedisConnected;
exports.default = {
    connect: exports.connectRedis,
    getClient: exports.getRedisClient,
    isConnected: exports.isRedisConnected,
    client: initializeRedis()
};
//# sourceMappingURL=redis.js.map
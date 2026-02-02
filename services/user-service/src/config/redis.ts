import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || '6379';
const redisUrl = process.env.REDIS_URL || `redis://${redisHost}:${redisPort}`;

export const redisClient: RedisClientType = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries: number) => {
      const delay = Math.min(retries * 50, 2000);
      return delay;
    }
  }
});

redisClient.on('error', (err) => {
  logger.error('Redis error:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis connected');
});

redisClient.on('reconnecting', () => {
  logger.warn('Redis reconnecting');
});

// Connect to Redis with retry
const connectRedis = () => {
  redisClient.connect()
    .catch((err) => {
      logger.warn('Redis connection failed, will retry in 5s...', err);
      setTimeout(connectRedis, 5000);
    });
};

connectRedis();

export const closeRedisConnection = async () => {
  await redisClient.quit();
  logger.info('Redis connection closed');
};

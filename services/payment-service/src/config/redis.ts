import { createClient, RedisClientType } from "redis";
import { logger } from '../utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient: RedisClientType = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries: number) => {
      const delay = Math.min(retries * 50, 2000);
      return delay;
    }
  }
} as any);

redisClient.on('error', (err) => {
  logger.error('Redis error:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis connected');
});

redisClient.on('reconnecting', () => {
  logger.warn('Redis reconnecting');
});

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

import { createClient } from 'redis';
import { logger } from '../utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

export const redisClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries: number) => {
      if (retries > 10) {
        logger.error('Redis reconnect max retries reached');
        return new Error('Redis max retries');
      }
      return Math.min(retries * 100, 3000);
    }
  }
});

redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
redisClient.on('connect', () => logger.info('Live Service connected to Redis'));

export const connectRedis = async (): Promise<void> => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
  }
};

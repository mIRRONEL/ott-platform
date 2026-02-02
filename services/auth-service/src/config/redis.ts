import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

let redisClient: RedisClientType | null = null;
let isConnected = false;

const initializeRedis = () => {
  if (redisClient) return redisClient;
  
  redisClient = createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('Redis reconnection failed after 10 attempts');
          return new Error('Redis max retries exceeded');
        }
        return retries * 50;
      }
    }
  } as any);

  redisClient.on('error', (err: any) => {
    isConnected = false;
    logger.warn('Redis error:', err);
  });

  redisClient.on('connect', () => {
    isConnected = true;
    logger.info('Redis connected');
  });

  redisClient.on('reconnecting', () => {
    logger.info('Redis reconnecting...');
  });

  return redisClient;
};

export const connectRedis = async (): Promise<void> => {
  try {
    const client = initializeRedis();
    if (client && !isConnected) {
      await client.connect();
      isConnected = true;
      logger.info('Redis connected successfully');
    }
  } catch (error) {
    isConnected = false;
    logger.warn('Redis connection failed, cache operations will be unavailable:', error);
  }
};

export const getRedisClient = (): RedisClientType | null => {
  if (!redisClient) {
    initializeRedis();
  }
  return redisClient;
};

export const isRedisConnected = (): boolean => {
  return isConnected && redisClient !== null;
};

export default {
  connect: connectRedis,
  getClient: getRedisClient,
  isConnected: isRedisConnected,
  client: initializeRedis()
};

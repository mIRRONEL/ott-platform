import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

let redisClient: RedisClientType | null = null;
let isConnected = false;

const initializeRedis = () => {
  if (redisClient) return redisClient;
  
  const redisHost = process.env.REDIS_HOST || 'redis';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379');
  const redisPassword = process.env.REDIS_PASSWORD || 'IJQWO2DBGY3QU';

  const redisUrl = process.env.REDIS_URL || `redis://:${encodeURIComponent(redisPassword)}@${redisHost}:${redisPort}`;

  redisClient = createClient({
    url: redisUrl,
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

export const setKey = async (key: string, value: string, ttlSeconds?: number): Promise<void> => {
  try {
    const client = getRedisClient();
    if (client && isConnected) {
      if (ttlSeconds) {
        await client.set(key, value, { EX: ttlSeconds });
      } else {
        await client.set(key, value);
      }
    }
  } catch (err) {
    logger.warn(`Redis set error for ${key}:`, err);
  }
};

export const getKey = async (key: string): Promise<string | null> => {
  try {
    const client = getRedisClient();
    if (client && isConnected) {
      return await client.get(key);
    }
    return null;
  } catch (err) {
    logger.warn(`Redis get error for ${key}:`, err);
    return null;
  }
};

export const deleteKey = async (key: string): Promise<void> => {
  try {
    const client = getRedisClient();
    if (client && isConnected) {
      await client.del(key);
    }
  } catch (err) {
    logger.warn(`Redis del error for ${key}:`, err);
  }
};

export default {
  connect: connectRedis,
  getClient: getRedisClient,
  isConnected: isRedisConnected,
  setKey,
  getKey,
  deleteKey,
  client: initializeRedis()
};


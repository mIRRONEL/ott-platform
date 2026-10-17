import Redis from 'ioredis';
import { logger } from '../utils/logger';

const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

export const redisClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  lazyConnect: true,
  retryStrategy: (times) => {
    const delay = Math.min(times * 100, 3000);
    return delay;
  }
});

let isRedisConnected = false;

redisClient.on('connect', () => {
  isRedisConnected = true;
  logger.info('✓ Redis client connected for distributed rate limiting');
});

redisClient.on('error', (err) => {
  isRedisConnected = false;
  logger.warn('Redis connection warning (falling back to memory store if needed):', err.message);
});

export const getRedisStatus = () => isRedisConnected;

export const initRedis = async () => {
  try {
    await redisClient.connect();
  } catch (err: any) {
    logger.warn('Initial Redis connection failed, will retry in background:', err.message);
  }
};

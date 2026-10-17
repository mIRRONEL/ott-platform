import { Request, Response, NextFunction } from 'express';
import rateLimit, { Options } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';

// Helper to determine if request is from internal cluster or monitoring
const isInternalOrMonitoring = (req: Request): boolean => {
  const path = req.path || '';
  const internalSecret = req.headers['x-internal-service-secret'];

  // Whitelist internal secret
  if (internalSecret && internalSecret === process.env.INTERNAL_SERVICE_SECRET) {
    return true;
  }

  // Whitelist health checks & Prometheus metrics
  if (
    path === '/health' ||
    path === '/metrics' ||
    path === '/status' ||
    path.startsWith('/health') ||
    path.startsWith('/metrics') ||
    path.startsWith('/api/health')
  ) {
    return true;
  }

  // Whitelist HLS video segments and playlists (.ts, .m3u8)
  if (path.includes('segment_') || path.includes('.ts') || path.includes('.m3u8')) {
    return true;
  }

  return false;
};

// Standard key generator (User ID first, then IP)
const standardKeyGenerator = (req: Request): string => {
  const userId = (req as any).user?.userId || (req as any).user?.id || (req as any).userId;
  if (userId) {
    return `usr:${userId}`;
  }
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown_client';
  return `ip:${clientIp}`;
};

// Factory for production tier rate limiters
const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  prefix: string;
  message: string;
  skip?: (req: Request) => boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: (req: Request) => {
      // VIP Tier gets 3x quota on general API endpoints
      const user = (req as any).user;
      if (user?.subscriptionTier === 'VIP_4K' || user?.isVip) {
        return options.max * 3;
      }
      return options.max;
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      // @ts-ignore
      sendCommand: (...args: string[]) => redisClient.call(...args),
      prefix: `rl:${options.prefix}:`,
    }),
    keyGenerator: standardKeyGenerator,
    skip: (req: Request) => {
      if (isInternalOrMonitoring(req)) return true;
      if (options.skip) return options.skip(req);
      return false;
    },
    handler: (req: Request, res: Response, next: NextFunction, opts: Options) => {
      const retryAfterSec = Math.ceil(options.windowMs / 1000);
      res.setHeader('Retry-After', retryAfterSec.toString());
      logger.warn(`Rate limit exceeded for [${standardKeyGenerator(req)}] on ${req.method} ${req.path}`);
      
      res.status(429).json({
        status: 'error',
        code: 'RATE_LIMIT_EXCEEDED',
        message: options.message,
        retryAfterSeconds: retryAfterSec,
        endpoint: req.originalUrl || req.path
      });
    }
  });
};

// 1. Auth Limiter - 10 attempts per minute (prevents credential stuffing)
export const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  prefix: 'auth',
  message: 'Too many authentication attempts. Please slow down and try again in 1 minute.',
  skip: (req) => req.method === 'GET' // Skip token verification reads
});

// 2. Payment Limiter - 15 checkout/billing actions per minute
export const paymentLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  prefix: 'pay',
  message: 'Too many billing requests. Please wait a moment before trying again.'
});

// 3. General API Limiter - 300 requests per minute (VIP gets 900 req/min)
export const apiGeneralLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  prefix: 'api',
  message: 'API rate limit exceeded. Please throttle your requests.',
  skip: (req) => {
    const path = req.path || '';
    // Skip polling progress
    if (path.includes('/progress')) return true;
    return false;
  }
});

// 4. Streaming Limiter - 2000 requests per minute (HLS segments are already skipped)
export const streamingLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 2000,
  prefix: 'stream',
  message: 'Streaming request limit reached. Please refresh player in a moment.'
});

// 5. Upload Limiter - 1000 chunk uploads per minute
export const uploadLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 1000,
  prefix: 'upload',
  message: 'Upload bandwidth rate limit exceeded. Chunks are uploading too rapidly.'
});

export const rateLimitMiddleware = {
  api: apiGeneralLimiter,
  auth: authLimiter,
  payment: paymentLimiter,
  streaming: streamingLimiter,
  upload: uploadLimiter
};

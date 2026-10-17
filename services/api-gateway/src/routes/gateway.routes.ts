import { Router, Request, Response, NextFunction } from 'express';
import proxy from 'express-http-proxy';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { requestLogger } from '../middleware/request-logger.middleware';
import { uploadVideoHandler, uploadChunkHandler } from '../middleware/upload.handler';
import upload from '../config/multer';

const router = Router();

const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'ott_sec_gateway_98a72b14c3e87019d08e54721c6';

// Helper function to add CORS headers to proxy responses
const addCorsHeaders = (resHeaders: any, srcRes: any, req: any, res: any) => {
  resHeaders['access-control-allow-origin'] = '*';
  resHeaders['access-control-allow-methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD';
  resHeaders['access-control-allow-headers'] = '*';
  resHeaders['access-control-expose-headers'] = '*';
  resHeaders['access-control-max-age'] = '86400';
  return resHeaders;
};

// Standard proxy request decorator for internal service-to-service trust & client metadata
const standardProxyDecorator = (customDecorator?: (proxyReqOpts: any, req: any) => any) => {
  return (proxyReqOpts: any, req: any) => {
    proxyReqOpts.headers = proxyReqOpts.headers || {};
    
    // Inject internal security secret to trust gateway
    proxyReqOpts.headers['x-internal-service-secret'] = INTERNAL_SECRET;
    
    // Forward client IP and protocol
    const rawForwarded = req.headers['x-forwarded-for'] as string;
    const clientIp = rawForwarded
      ? rawForwarded.split(',')[0].trim()
      : (req.headers['x-real-ip'] as string) || (req.headers['x-client-ip'] as string) || req.ip || req.socket.remoteAddress || '';

    proxyReqOpts.headers['x-forwarded-for'] = req.headers['x-forwarded-for'] || clientIp;
    proxyReqOpts.headers['x-real-ip'] = clientIp;
    proxyReqOpts.headers['x-client-ip'] = clientIp;
    proxyReqOpts.headers['x-forwarded-host'] = req.headers.host || '';
    proxyReqOpts.headers['x-forwarded-proto'] = req.protocol || 'http';

    // Forward auth headers
    if (req.headers.authorization) {
      proxyReqOpts.headers['authorization'] = req.headers.authorization;
    }

    // Forward user identity if authenticated
    if (req.user) {
      const userId = req.user.userId || req.user.id;
      if (userId) proxyReqOpts.headers['x-user-id'] = userId;
      if (req.user.role) proxyReqOpts.headers['x-user-role'] = req.user.role;
      if (req.user.subscriptionTier) proxyReqOpts.headers['x-user-tier'] = req.user.subscriptionTier;
    }

    // Apply custom decorations if provided
    if (customDecorator) {
      return customDecorator(proxyReqOpts, req);
    }

    return proxyReqOpts;
  };
};

// Helper function to forward paths
const createForwardPath = (servicePrefix: string) => (req: any) => `${servicePrefix}${req.url}`;

// Video Upload Handlers - Direct streaming proxy for chunks (zero-disk latency)
router.post('/content/upload/chunk', rateLimitMiddleware.upload, optionalAuthMiddleware, uploadChunkHandler);
router.post('/content/upload', rateLimitMiddleware.upload, optionalAuthMiddleware, upload.single('video'), uploadVideoHandler);

// 1. Auth Service - Login/register protected by strict auth rate limiter
router.use('/auth', rateLimitMiddleware.auth, (req, res, next) => {
  if (req.path.startsWith('/admin')) {
    authMiddleware(req, res, next);
  } else {
    next();
  }
}, requestLogger, proxy(process.env.AUTH_SERVICE_URL || 'http://localhost:3001', {
  changeOrigin: true,
  forwardPath: createForwardPath('/api/auth'),
  proxyReqOptDecorator: standardProxyDecorator(),
  userResHeaderDecorator: addCorsHeaders
}));

// 2. User Service - Authentication required
router.use('/users', authMiddleware, rateLimitMiddleware.api, requestLogger, proxy(process.env.USER_SERVICE_URL || 'http://localhost:3002', {
  changeOrigin: true,
  forwardPath: createForwardPath('/api/users'),
  proxyReqOptDecorator: standardProxyDecorator(),
  userResHeaderDecorator: addCorsHeaders
}));

// 3. Content Service - Authentication optional
router.use('/content', rateLimitMiddleware.api, requestLogger, proxy(process.env.CONTENT_SERVICE_URL || 'http://localhost:3003', {
  changeOrigin: true,
  timeout: 300000,
  forwardPath: createForwardPath('/api/content'),
  proxyReqOptDecorator: standardProxyDecorator(),
  userResHeaderDecorator: addCorsHeaders
}));

// 4. Streaming Service - Public video playback & HLS manifests
router.use(['/stream', '/streaming'], rateLimitMiddleware.streaming, requestLogger, proxy(process.env.STREAMING_SERVICE_URL || 'http://localhost:3004', {
  changeOrigin: true,
  forwardPath: (req: any) => `/api/stream${req.url}`,
  proxyReqOptDecorator: standardProxyDecorator((proxyReqOpts, req) => {
    proxyReqOpts.headers['x-forwarded-host'] = req.headers.host;
    proxyReqOpts.headers['x-forwarded-proto'] = req.protocol;
    return proxyReqOpts;
  }),
  userResHeaderDecorator: addCorsHeaders
}));

// 5. Payment Service - Authentication required + strict payment limiter
router.use('/payments', authMiddleware, rateLimitMiddleware.payment, requestLogger, proxy(process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005', {
  changeOrigin: true,
  forwardPath: createForwardPath('/api/payments'),
  proxyReqOptDecorator: standardProxyDecorator(),
  userResHeaderDecorator: addCorsHeaders
}));

// 6. Notification Service - Authentication required
router.use('/notifications', authMiddleware, rateLimitMiddleware.api, requestLogger, proxy(process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006', {
  changeOrigin: true,
  forwardPath: createForwardPath('/api/notifications'),
  proxyReqOptDecorator: standardProxyDecorator(),
  userResHeaderDecorator: addCorsHeaders
}));

// 7. Analytics Service - Authentication required
router.use('/analytics', authMiddleware, rateLimitMiddleware.api, requestLogger, proxy(process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3007', {
  changeOrigin: true,
  forwardPath: createForwardPath('/api/analytics'),
  proxyReqOptDecorator: standardProxyDecorator(),
  userResHeaderDecorator: addCorsHeaders
}));

// 8. Encoding Service - Internal / Admin transcoding operations
router.use('/encoding', authMiddleware, rateLimitMiddleware.api, requestLogger, proxy(process.env.ENCODING_SERVICE_URL || 'http://localhost:3008', {
  changeOrigin: true,
  forwardPath: createForwardPath('/api/encoding'),
  proxyReqOptDecorator: standardProxyDecorator(),
  userResHeaderDecorator: addCorsHeaders
}));

// 9. Live Streaming Service - Creator RTMP Ingest & Low-Latency HLS
router.use('/live', rateLimitMiddleware.streaming, requestLogger, proxy(process.env.LIVE_SERVICE_URL || 'http://live-service:3009', {
  changeOrigin: true,
  forwardPath: (req: any) => `/api/live${req.url}`,
  proxyReqOptDecorator: standardProxyDecorator((proxyReqOpts, req) => {
    proxyReqOpts.headers['x-forwarded-host'] = req.headers.host;
    proxyReqOpts.headers['x-forwarded-proto'] = req.protocol;
    return proxyReqOpts;
  }),
  userResHeaderDecorator: addCorsHeaders
}));

export default router;

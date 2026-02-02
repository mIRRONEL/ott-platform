import { Router, Request, Response, NextFunction } from 'express';
import proxy from 'express-http-proxy';
import { authMiddleware } from '../middleware/auth.middleware';
import { rateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { requestLogger } from '../middleware/request-logger.middleware';
import { uploadVideoHandler } from '../middleware/upload.handler';
import upload from '../config/multer';

const router = Router();

// Helper function to add CORS headers to proxy responses
const addCorsHeaders = (resHeaders: any, srcRes: any, req: any, res: any) => {
  const origin = req.get ? req.get('origin') : req.headers.origin;
  const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'];
  
  if (origin && allowedOrigins.includes(origin)) {
    resHeaders['access-control-allow-origin'] = origin;
  } else {
    resHeaders['access-control-allow-origin'] = 'http://localhost:5173';
  }
  
  resHeaders['access-control-allow-credentials'] = 'true';
  resHeaders['access-control-allow-methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD';
  resHeaders['access-control-allow-headers'] = 'Content-Type,Authorization,X-Requested-With';
  resHeaders['access-control-expose-headers'] = 'X-Total-Count,X-Page-Number';
  
  return resHeaders;
};

// Helper function to forward paths
const createForwardPath = (servicePrefix: string) => (req: any) => `${servicePrefix}${req.url}`;

// Video Upload - Handle separately to avoid proxy issues with multipart
router.post('/content/upload', upload.single('video'), uploadVideoHandler);

// Auth Service - Login/register don't need auth, but admin endpoints do
router.use('/auth', (req, res, next) => {
  // Only apply auth middleware for admin routes
  if (req.path.startsWith('/admin')) {
    authMiddleware(req, res, next);
  } else {
    next();
  }
}, requestLogger, proxy(process.env.AUTH_SERVICE_URL || 'http://localhost:3001', {
  changeOrigin: true,
  forwardPath: createForwardPath('/api/auth'),
  proxyReqOptDecorator: (proxyReqOpts, req) => {
    // Forward all headers including Authorization
    if (req.headers.authorization) {
      proxyReqOpts.headers = proxyReqOpts.headers || {};
      proxyReqOpts.headers['authorization'] = req.headers.authorization;
    }
    return proxyReqOpts;
  },
  userResHeaderDecorator: addCorsHeaders
}));

// User Service - Authentication required
router.use('/users', authMiddleware, rateLimitMiddleware.api, requestLogger, proxy(process.env.USER_SERVICE_URL || 'http://localhost:3002', {
  changeOrigin: true,
  forwardPath: createForwardPath('/api/users'),
  proxyReqOptDecorator: (proxyReqOpts, req: any) => {
    // Forward user ID as header for profile endpoint
    if (req.user?.userId) {
      proxyReqOpts.headers = proxyReqOpts.headers || {};
      proxyReqOpts.headers['x-user-id'] = req.user.userId;
    }
    return proxyReqOpts;
  },
  userResHeaderDecorator: addCorsHeaders
}));

// Content Service - Authentication optional
router.use('/content', requestLogger, proxy(process.env.CONTENT_SERVICE_URL || 'http://localhost:3003', {
  changeOrigin: true,
  forwardPath: createForwardPath('/api/content'),
  userResHeaderDecorator: addCorsHeaders
}));

// Streaming Service - Authentication required
router.use('/stream', authMiddleware, rateLimitMiddleware.streaming, requestLogger, proxy(process.env.STREAMING_SERVICE_URL || 'http://localhost:3004', {
  changeOrigin: true,
  forwardPath: createForwardPath('/api/stream'),
  userResHeaderDecorator: addCorsHeaders
}));

// Payment Service - Authentication required
router.use('/payments', authMiddleware, rateLimitMiddleware.api, requestLogger, proxy(process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005', {
  changeOrigin: true,
  forwardPath: createForwardPath('/api/payments'),
  userResHeaderDecorator: addCorsHeaders
}));

// Notification Service - Authentication required
router.use('/notifications', authMiddleware, rateLimitMiddleware.api, requestLogger, proxy(process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006', {
  changeOrigin: true,
  forwardPath: createForwardPath('/api/notifications'),
  userResHeaderDecorator: addCorsHeaders
}));

// Analytics Service - Authentication required
router.use('/analytics', authMiddleware, rateLimitMiddleware.api, requestLogger, proxy(process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3007', {
  changeOrigin: true,
  forwardPath: createForwardPath('/api/analytics'),
  userResHeaderDecorator: addCorsHeaders
}));

export default router;

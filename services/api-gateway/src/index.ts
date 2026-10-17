import "./utils/secrets";
import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import dotenv from 'dotenv';
import gatewayRoutes from './routes/gateway.routes';
import { errorHandler } from './middleware/error.handler';
import { rateLimitMiddleware } from './middleware/rate-limit.middleware';
import { adminOnlyMiddleware } from './middleware/auth.middleware';
import { logger } from './utils/logger';
import { initializeServiceRegistry, getServiceStatus, getClusterHealth } from './services/service-discovery';
import { metricsRegistry, metricsMiddleware } from './utils/metrics';
import { initRedis } from './config/redis';

import { owaspSanitizerMiddleware } from './middleware/sanitizer.middleware';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.set('trust proxy', 1);

// Prometheus Metrics Middleware
app.use(metricsMiddleware);

// Strict Enterprise Security Headers via Helmet
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: false,
  frameguard: { action: 'sameorigin' },
  hidePoweredBy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Global CORS middleware that runs on all requests
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', '*');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Enable rate limiting globally (content/HLS/upload endpoints are skipped in middleware)
app.use(rateLimitMiddleware.api);
app.use(express.json({ limit: '5gb' }));
app.use(express.urlencoded({ limit: '5gb', extended: true }));

// OWASP Top 10 Request Sanitizer (NoSQL injection, XSS & Parameter Pollution Shield)
app.use(owaspSanitizerMiddleware);

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.debug(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Prometheus Metrics Endpoint
app.get('/metrics', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(metricsRegistry.getMetrics());
});

// Health check endpoint (Direct & Ingress-routed)
app.get(['/health', '/api/health'], (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Consolidated Cluster Health endpoint for Frontend System Page & Observability (Admin Only)
app.get('/api/health/cluster', adminOnlyMiddleware, async (req: Request, res: Response) => {
  const clusterHealth = await getClusterHealth();
  const statusCode = clusterHealth.status === 'HEALTHY' ? 200 : clusterHealth.status === 'DEGRADED' ? 200 : 503;
  res.status(statusCode).json(clusterHealth);
});

// Service status endpoint
app.get('/status', (req: Request, res: Response) => {
  const status = getServiceStatus();
  res.status(200).json(status);
});

// API Routes
app.use('/api/v1', gatewayRoutes);
app.use('/api', gatewayRoutes);  // Also support /api without v1 for backwards compatibility

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found',
    statusCode: 404,
    path: req.path
  });
});

// Error handler
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Initialize Redis connection for distributed rate limiting
    await initRedis();

    // Initialize service discovery
    initializeServiceRegistry();

    const server = app.listen(PORT, () => {
      logger.info(`API Gateway listening on port ${PORT}`);
      logger.info('Service discovery initialized');
    });
    server.setTimeout(3600000); // 1 hour timeout for large video uploads
    server.keepAliveTimeout = 120000;
    server.headersTimeout = 125000;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;

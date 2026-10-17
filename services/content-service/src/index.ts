import "./utils/secrets";
import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import fs from 'fs';
import contentRoutes from './routes/content.routes';
import { errorHandler } from './middleware/error.handler';
import { logger } from './utils/logger';
import { initializeKafkaConsumer, disconnectConsumer } from './kafka/consumer';
import { metricsRegistry, metricsMiddleware } from './utils/metrics';

dotenv.config();

logger.info('Starting content-service initialization...');

const app: Application = express();
const PORT = process.env.PORT || 3003;

logger.info(`Content-service listening on port ${PORT}`);

// Trust proxy
app.set('trust proxy', 1);

// Prometheus Metrics Middleware
app.use(metricsMiddleware);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: false
}));

// Set request timeout for large uploads (default 10 minutes)
const requestTimeout = parseInt(process.env.REQUEST_TIMEOUT || '600000');
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setTimeout(requestTimeout);
  next();
});

app.use(cors({
  origin: '*',
  credentials: true
}));

// Rate limiting - strict for API endpoints (skip upload/progress polling)
const rateLimitWindowMs = parseInt(process.env.CONTENT_RATE_LIMIT_WINDOW_MS || '900000');
const rateLimitMax = parseInt(process.env.CONTENT_RATE_LIMIT_MAX || '100');

const limiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: rateLimitMax,
  message: 'Too many requests, please try again later.',
  skip: (req) => {
    const secret = req.headers['x-internal-service-secret'];
    if (secret && secret === process.env.INTERNAL_SERVICE_SECRET) return true;
    const path = req.path || '';
    const isGet = req.method === 'GET';
    // Skip health & metrics endpoints
    if (path === '/health' || path === '/metrics' || path.startsWith('/health') || path.startsWith('/metrics')) return true;
    // Skip HLS streaming endpoints entirely
    if (path.startsWith('/api/content/hls') || path.startsWith('/hls')) return true;
    // Skip uploads
    if (path.startsWith('/api/content/upload') || path.startsWith('/uploads')) return true;
    // Skip progress polling
    if (path.includes('/progress')) return true;
    // Skip studio management endpoints
    if (path.includes('/studio')) return true;
    // Skip content listing/detail reads to avoid 429 on multiple tabs
    if (isGet && path.startsWith('/api/content/videos')) return true;
    // Skip HLS segment files
    if (path.includes('segment_') || path.includes('.ts')) return true;
    return false;
  }
});

// Rate limiting - lenient for HLS streaming (needs many rapid requests)
const hlsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 5000, // Very high limit for HLS segment requests (allows ~83 segments per second)
  message: 'Too many requests, please try again later.',
  skip: (req) => {
    // Don't rate limit static HLS file serves
    return req.method === 'GET';
  }
});

// Apply HLS limiter before other middleware
app.use('/api/content/hls', hlsLimiter);
app.use('/hls', hlsLimiter);

// Apply general limiter to everything else
app.use(limiter);

// Body parser middleware (allow large base64 thumbnails and complete payloads)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Serve uploaded videos as static files from /tmp/ott-uploads
app.use('/uploads', express.static('/tmp/ott-uploads'));
app.use('/api/content/uploads', express.static('/tmp/ott-uploads'));

// Serve HLS segments from HLS output directory
const hlsDir = process.env.HLS_OUTPUT_DIR || '/tmp/ott-hls';
if (!fs.existsSync(hlsDir)) {
  fs.mkdirSync(hlsDir, { recursive: true });
}
app.use('/hls', express.static(hlsDir));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
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

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    service: 'content-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
logger.info('Loading content routes...');
app.use('/api/content', contentRoutes);
logger.info('Content routes loaded successfully');

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.path} not found`,
    code: 'NOT_FOUND'
  });
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, closing gracefully...');
  await disconnectConsumer();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

import { startHousekeeper } from './utils/housekeeper';

// Start server
logger.info('Starting server...');
const server = app.listen(PORT, async () => {
  logger.info(`🚀 Content Service running on port ${PORT}`);
  
  // Start background housekeeper / garbage collector
  startHousekeeper();

  // Initialize Kafka consumer (non-blocking)
  const initKafkaWithRetry = () => {
    initializeKafkaConsumer().catch(err => {
      logger.warn('Failed to initialize Kafka consumer, will retry in 5s...', err);
      setTimeout(initKafkaWithRetry, 5000);
    });
  };
  initKafkaWithRetry();
});

logger.info('Server listener attached');

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.warn('Unhandled Rejection:', err);
});

export default app;

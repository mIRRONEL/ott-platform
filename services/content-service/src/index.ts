import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import fs from 'fs';
import contentRoutes from './routes/content.routes';
import { errorHandler } from './middleware/error.handler';
import { logger } from './utils/logger';

dotenv.config();

logger.info('Starting content-service initialization...');

const app: Application = express();
const PORT = process.env.PORT || 3003;

logger.info(`Content-service listening on port ${PORT}`);

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Set request timeout for large uploads (default 10 minutes)
const requestTimeout = parseInt(process.env.REQUEST_TIMEOUT || '600000');
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setTimeout(requestTimeout);
  next();
});

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'localhost:3000', 'localhost:5173'],
  credentials: true
}));

// Rate limiting - strict for API endpoints (skip upload/progress polling)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
  skip: (req) => {
    const path = req.path || '';
    // Skip HLS streaming endpoints entirely
    if (path.startsWith('/api/content/hls') || path.startsWith('/hls')) return true;
    // Skip uploads
    if (path.startsWith('/api/content/upload') || path.startsWith('/uploads')) return true;
    // Skip progress polling
    if (path.includes('/progress')) return true;
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

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded videos as static files from /tmp/ott-uploads
app.use('/uploads', express.static('/tmp/ott-uploads'));

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
const gracefulShutdown = () => {
  logger.info('Received shutdown signal, closing gracefully...');
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
logger.info('Starting server...');
const server = app.listen(PORT, () => {
  logger.info(`🚀 Content Service running on port ${PORT}`);
});

logger.info('Server listener attached');

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.warn('Unhandled Rejection:', err);
});

export default app;

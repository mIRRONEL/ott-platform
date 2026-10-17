import "./utils/secrets";
import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import userRoutes from './routes/user.routes';
import { errorHandler } from './middleware/error.handler';
import { logger } from './utils/logger';
import { metricsRegistry, metricsMiddleware } from './utils/metrics';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3002;

// Trust proxy
app.set('trust proxy', 1);

// Prometheus Metrics Middleware
app.use(metricsMiddleware);

// Prometheus Metrics Endpoint
app.get('/metrics', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(metricsRegistry.getMetrics());
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    service: 'user-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting - Gateway traffic with internal secret is whitelisted
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: 'Too many requests, please try again later.',
  skip: (req: Request) => {
    const secret = req.headers['x-internal-service-secret'];
    if (secret && secret === process.env.INTERNAL_SERVICE_SECRET) return true;
    return req.path === '/health' || req.path === '/metrics';
  }
});
app.use(limiter);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// API routes
app.use('/api/users', userRoutes);

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
const server = app.listen(PORT, () => {
  logger.info(`🚀 User Service running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.warn('Unhandled Rejection:', err);
  // Don't exit - let the service continue running
  // Kafka connection errors should be retried, not fatal
});

export default app;

import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import streamingRoutes from './routes/streaming.routes';
import { errorHandler } from './middleware/error.handler';
import { logger } from './utils/logger';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3004;

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting for streaming
const streamLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  keyGenerator: (req: Request) => {
    return req.ip || 'unknown';
  }
});

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

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    service: 'streaming-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/stream', streamLimiter, streamingRoutes);

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
  logger.info(`🚀 Streaming Service running on port ${PORT}`);
});

process.on('unhandledRejection', (err: Error) => {
  logger.warn('Unhandled Rejection:', err);
  // Don't exit - let the service continue running
  // Kafka connection errors should be retried, not fatal
});

export default app;

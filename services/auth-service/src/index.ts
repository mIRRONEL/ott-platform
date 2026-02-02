import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { logger } from './utils/logger';
import authRoutes from './routes/auth.routes';
import { errorHandler } from './middleware/error.handler';
import { connectDatabase } from './database/connection';
import { connectKafka } from './kafka/producer';
import { connectRedis } from './config/redis';
import { swaggerSpec } from './config/swagger';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;

// =============================================
// MIDDLEWARE
// =============================================

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info({
    method: req.method,
    path: req.path,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  next();
});

// =============================================
// ROUTES
// =============================================

app.use('/api/auth', authRoutes);

// API Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'auth-service',
    timestamp: new Date().toISOString()
  });
});

// =============================================
// ERROR HANDLING
// =============================================

app.use(errorHandler);

// =============================================
// SERVER STARTUP
// =============================================

async function startServer() {
  try {
    // Connect to PostgreSQL
    await connectDatabase();
    logger.info('✓ PostgreSQL connected');

    // Connect to Redis (non-blocking)
    connectRedis()
      .then(() => {
        logger.info('✓ Redis connected');
      })
      .catch((error) => {
        logger.warn('Redis connection failed, will continue without cache...', error);
      });

    // Connect to Kafka (non-blocking)
    connectKafka()
      .then(() => {
        logger.info('✓ Kafka connected');
      })
      .catch((error) => {
        logger.warn('Kafka connection failed, will retry...', error);
      });

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Auth Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Handle uncaught rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();

export default app;

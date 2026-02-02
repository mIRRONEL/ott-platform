import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import analyticsRoutes from './routes/analytics.routes';
import { errorHandler } from './middleware/error.handler';
import { logger } from './utils/logger';
import { initializeKafkaConsumer, stopKafkaConsumer } from './kafka/consumer';
import { connectMongoDB, closeMongoDBConnection, getMongoDb } from './database/mongodb.connection';
import { pgPool, closePgConnection } from './database/connection';
import * as analyticsService from './services/analytics.service';
import * as recommendationService from './services/recommendation.service';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3007;

// Middleware
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
});

app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
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
    service: 'analytics-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes
app.use('/api/v1/analytics', analyticsRoutes);

// Error handler
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  try {
    await stopKafkaConsumer();
    await closePgConnection();
    await closeMongoDBConnection();
    logger.info('All connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Connect to databases
    const db = await connectMongoDB();
    analyticsService.setDatabases(pgPool, db);
    recommendationService.setDatabases(pgPool, db);

    // Initialize Kafka consumer (non-blocking)
    initializeKafkaConsumer().catch(error => {
      logger.warn('Kafka consumer initialization failed, will retry...', error);
    });

    app.listen(PORT, () => {
      logger.info(`Analytics service listening on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

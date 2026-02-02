import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import notificationRoutes from './routes/notification.routes';
import { errorHandler } from './middleware/error.handler';
import { logger } from './utils/logger';
import { initializeKafkaConsumer } from './kafka/consumer';
import { swaggerSpec } from './config/swagger';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3006;

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

app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    service: 'notification-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Simple endpoints for frontend
app.get('/api/notifications', (req: Request, res: Response) => {
  res.json({
    data: [{
      id: '1',
      title: 'Welcome',
      message: 'Welcome to OTT Platform!',
      type: 'info',
      read: false,
      createdAt: new Date().toISOString()
    }]
  });
});

app.put('/api/notifications/:notificationId/read', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Notification marked as read' });
});

app.delete('/api/notifications/:notificationId', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Notification deleted' });
});


// API Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/notifications', notificationRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.path} not found`,
    code: 'NOT_FOUND'
  });
});

app.use(errorHandler);

const gracefulShutdown = () => {
  logger.info('Received shutdown signal, closing gracefully...');
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Initialize Kafka consumer with retry (non-blocking)
const initKafkaWithRetry = () => {
  initializeKafkaConsumer().catch(err => {
    logger.warn('Failed to initialize Kafka consumer, will retry in 5s...', err);
    setTimeout(initKafkaWithRetry, 5000);
  });
};

initKafkaWithRetry();

const server = app.listen(PORT, () => {
  logger.info(`🚀 Notification Service running on port ${PORT}`);
});

process.on('unhandledRejection', (err: Error) => {
  logger.warn('Unhandled Rejection:', err);
});

export default app;

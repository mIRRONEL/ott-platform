import "./utils/secrets";
import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import paymentRoutes from './routes/payment.routes';
import { errorHandler } from './middleware/error.handler';
import { logger } from './utils/logger';
import { swaggerSpec } from './config/swagger';
import { metricsRegistry, metricsMiddleware } from './utils/metrics';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3005;

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
    service: 'payment-service',
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

// Rate limiting - Protects direct microservice access; Gateway traffic with internal secret is whitelisted
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests, please try again later.',
  skip: (req: Request) => {
    const secret = req.headers['x-internal-service-secret'];
    if (secret && secret === process.env.INTERNAL_SERVICE_SECRET) return true;
    return req.path === '/health' || req.path === '/metrics';
  }
});

// Strict rate limiting for payment endpoints (skips internal gateway)
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  skip: (req: Request) => {
    const secret = req.headers['x-internal-service-secret'];
    return !!(secret && secret === process.env.INTERNAL_SERVICE_SECRET);
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

// API Documentation

// Simple endpoints for frontend
app.get('/api/payments/subscriptions', (req: Request, res: Response) => {
  res.json({
    data: [
      { id: '1', name: 'Basic', price: 4.99, features: ['720p HD', 'Watch on 1 device', 'Ad-supported'], active: false },
      { id: '2', name: 'Standard', price: 9.99, features: ['1080p Full HD', 'Watch on 2 devices', 'Ad-free'], active: false },
      { id: '3', name: 'Premium', price: 15.99, features: ['4K Ultra HD', 'Watch on 4 devices', 'Ad-free', 'Download content'], active: false }
    ]
  });
});

app.get('/api/payments/history', (req: Request, res: Response) => {
  res.json({
    data: [{
      id: '1', amount: 9.99, status: 'completed', date: new Date().toISOString(), subscription: 'Standard'
    }]
  });
});

app.post('/api/payments/subscribe', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Successfully subscribed' });
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
app.use('/api/payments', paymentLimiter, paymentRoutes);

// Webhook route (bypass rate limiting for Stripe)
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res, next) => {
  // This is a placeholder - actual webhook handling would be in the routes
  logger.info('Stripe webhook received');
  res.status(200).json({ received: true });
});

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
  logger.info(`🚀 Payment Service running on port ${PORT}`);
});

process.on('unhandledRejection', (err: Error) => {
  logger.warn('Unhandled Rejection:', err);
  // Don't exit - let the service continue running
  // Kafka connection errors should be retried, not fatal
});

export default app;

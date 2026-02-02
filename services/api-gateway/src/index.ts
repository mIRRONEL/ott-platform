import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import dotenv from 'dotenv';
import gatewayRoutes from './routes/gateway.routes';
import { errorHandler } from './middleware/error.handler';
import { rateLimitMiddleware } from './middleware/rate-limit.middleware';
import { logger } from './utils/logger';
import { initializeServiceRegistry, getServiceStatus } from './services/service-discovery';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.set('trust proxy', 1);

// CORS will be handled by route-level middleware for better control
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false
}));

// Global CORS middleware that runs on all requests
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.get('origin');
  const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count,X-Page-Number');
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

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.debug(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
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
const startServer = () => {
  try {
    // Initialize service discovery
    initializeServiceRegistry();

    app.listen(PORT, () => {
      logger.info(`API Gateway listening on port ${PORT}`);
      logger.info('Service discovery initialized');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;

import "./utils/secrets";
import express, { Application, Request, Response, NextFunction } from 'express';
import http from 'http';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import liveRoutes from './routes/live.routes';
import { logger } from './utils/logger';
import { metricsRegistry, metricsMiddleware } from './utils/metrics';
import { connectMongoDB } from './database/mongodb.connection';
import { connectRedis } from './config/redis';
import { connectKafka } from './kafka/producer';
import { startRTMPServer } from './services/rtmp.server';
import { initChatSocket } from './services/chat.socket';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3009;

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
    service: 'live-service',
    rtmpPort: process.env.RTMP_PORT || 1935,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: '*',
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: 'Too many requests, please try again later.',
  skip: (req: Request) => req.path === '/health' || req.path === '/metrics'
});

app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount Live API Routes
app.use('/api/live', liveRoutes);

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled Live Service Error:', err);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal Live Server Error'
  });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket for real-time live chat & viewer counts
initChatSocket(server);

// Start server
const startService = async (): Promise<void> => {
  try {
    await connectMongoDB();
    await connectRedis();
    await connectKafka();

    // Start RTMP Server
    startRTMPServer();

    server.listen(PORT, () => {
      logger.info(`Live HTTP & WebSocket Service running on port ${PORT}`);
      logger.info(`RTMP Broadcast Ingest ready on rtmp://180.94.20.40:${process.env.RTMP_PORT || 1935}/live`);
    });
  } catch (error) {
    logger.error('Failed to start live-service:', error);
    process.exit(1);
  }
};

startService();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing live HTTP server');
  server.close(() => {
    logger.info('Live HTTP server closed');
  });
});

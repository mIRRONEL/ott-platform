import "./utils/secrets";
import express from 'express';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { initializeKafkaConsumer, disconnectConsumer } from './kafka/consumer';
import { disconnectProducer } from './kafka/producer';
import encodingRoutes from './routes/encoding.routes';
import { metricsRegistry, metricsMiddleware } from './utils/metrics';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3008;

// Middleware
app.use(metricsMiddleware);
app.use(express.json());

// Prometheus Metrics Endpoint
app.get('/metrics', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(metricsRegistry.getMetrics());
});

// Routes
app.use('/api/encoding', encodingRoutes);

// Health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'encoding-service',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.path} not found`
  });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, closing gracefully...');
  await disconnectConsumer();
  await disconnectProducer();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Initialize Kafka consumer (non-blocking)
const initKafkaWithRetry = () => {
  initializeKafkaConsumer().catch(err => {
    logger.warn('Failed to initialize Kafka consumer, will retry in 5s...', err);
    setTimeout(initKafkaWithRetry, 5000);
  });
};

// Start server
app.listen(PORT, async () => {
  logger.info(`✓ Encoding service running on port ${PORT}`);
  
  // Initialize Kafka in background
  initKafkaWithRetry();
});

export default app;

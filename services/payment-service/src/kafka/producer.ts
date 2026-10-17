import { Kafka, Partitioners, Producer } from 'kafkajs';
import { logger } from '../utils/logger';

const kafka = new Kafka({
  clientId: 'payment-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092,localhost:9094,localhost:9096').split(','),
  retry: {
    initialRetryTime: parseInt(process.env.KAFKA_RETRY_INITIAL_RETRY_TIME || '100'),
    retries: Number.MAX_SAFE_INTEGER,
    maxRetryTime: 30000,
    multiplier: 2,
  },
  connectionTimeout: parseInt(process.env.KAFKA_CONNECT_TIMEOUT || '15000'),
  requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || '30000'),
});

export const kafkaProducer: Producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
  idempotent: true,
  maxInFlightRequests: 5,
});

// Auto-connect with retry logic (non-blocking)
const autoConnect = () => {
  kafkaProducer.connect()
    .then(() => {
      logger.info('Kafka producer connected');
    })
    .catch((err) => {
      logger.warn('Kafka producer connection failed, will retry in 5s...', err);
      setTimeout(autoConnect, 5000);
    });
};

// Start connection attempt in background
autoConnect();

kafkaProducer.on('producer.connect', () => {
  logger.info('Kafka producer reconnected');
});

kafkaProducer.on('producer.disconnect', () => {
  logger.warn('Kafka producer disconnected');
});

export const disconnectProducer = async () => {
  await kafkaProducer.disconnect();
  logger.info('Kafka producer disconnected');
};

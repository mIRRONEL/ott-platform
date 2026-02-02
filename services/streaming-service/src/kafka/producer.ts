import { Kafka, Producer } from 'kafkajs';
import { logger } from '../utils/logger';

const kafka = new Kafka({
  clientId: 'streaming-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

export const kafkaProducer: Producer = kafka.producer({
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

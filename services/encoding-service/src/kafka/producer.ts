import { Kafka, Partitioners, Producer } from 'kafkajs';
import { logger } from '../utils/logger';

const kafka = new Kafka({
  clientId: 'encoding-service',
  brokers: (process.env.KAFKA_BROKERS || 'kafka-1:9092,kafka-2:9092,kafka-3:9092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: Number.MAX_SAFE_INTEGER,
    maxRetryTime: 30000,
    multiplier: 2,
  },
  connectionTimeout: 15000,
  requestTimeout: 30000,
});

export const kafkaProducer: Producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
  idempotent: true,
  maxInFlightRequests: 5,
});

const autoConnect = () => {
  kafkaProducer.connect()
    .then(() => {
      logger.info('✓ Kafka producer connected (encoding-service)');
    })
    .catch((err) => {
      logger.warn('Kafka producer connection failed, will retry in 5s...', err);
      setTimeout(autoConnect, 5000);
    });
};

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

import { Kafka, Partitioners, logLevel } from 'kafkajs';
import { logger } from '../utils/logger';

const kafka = new Kafka({
  clientId: 'auth-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092,localhost:9094,localhost:9096').split(','),
  logLevel: logLevel.ERROR,
  retry: {
    initialRetryTime: parseInt(process.env.KAFKA_RETRY_INITIAL_RETRY_TIME || '100'),
    retries: Number.MAX_SAFE_INTEGER,
    maxRetryTime: 30000,
    multiplier: 2,
  },
  connectionTimeout: parseInt(process.env.KAFKA_CONNECT_TIMEOUT || '15000'),
  requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || '30000'),
  ssl: false,
  sasl: undefined,
  socketFactory: undefined,
});

export let producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
  idempotent: true,
  maxInFlightRequests: 5,
});

export async function connectKafka() {
  try {
    await producer.connect();
    logger.info('Kafka Producer connected successfully (3-broker KRaft cluster)');
  } catch (error) {
    logger.error('Kafka connection failed', error);
    throw error;
  }
}

export async function disconnectKafka() {
  try {
    await producer.disconnect();
    logger.info('Kafka Producer disconnected');
  } catch (error) {
    logger.error('Kafka disconnection failed', error);
  }
}

export default kafka;

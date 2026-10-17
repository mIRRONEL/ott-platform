import { Kafka, logLevel } from 'kafkajs';
import { logger } from '../utils/logger';

const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const clientId = 'analytics-service';
const groupId = process.env.KAFKA_CONSUMER_GROUP || 'analytics-service';

export const kafka = new Kafka({
  clientId,
  brokers,
  logLevel: logLevel.INFO,
  connectionTimeout: 10000,
  retry: {
    maxRetryTime: 30000,
    initialRetryTime: 100,
    multiplier: 2,
    retries: parseInt(process.env.KAFKA_PRODUCER_RETRIES || String(Number.MAX_SAFE_INTEGER)),
  },
});

export const kafkaConsumer = kafka.consumer({ groupId });
export const kafkaProducer = kafka.producer({
  idempotent: true,
  maxInFlightRequests: 5,
});

export const connectKafkaProducer = async () => {
  try {
    await kafkaProducer.connect();
    logger.info('Kafka producer connected');
  } catch (error) {
    logger.error('Failed to connect Kafka producer:', error);
    throw error;
  }
};

export const disconnectKafkaProducer = async () => {
  try {
    await kafkaProducer.disconnect();
    logger.info('Kafka producer disconnected');
  } catch (error) {
    logger.error('Failed to disconnect Kafka producer:', error);
  }
};

export const connectKafkaConsumer = async () => {
  try {
    await kafkaConsumer.connect();
    logger.info('Kafka consumer connected');
  } catch (error) {
    logger.error('Failed to connect Kafka consumer:', error);
    throw error;
  }
};

export const disconnectKafkaConsumer = async () => {
  try {
    await kafkaConsumer.disconnect();
    logger.info('Kafka consumer disconnected');
  } catch (error) {
    logger.error('Failed to disconnect Kafka consumer:', error);
  }
};

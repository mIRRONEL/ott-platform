import { Kafka, logLevel } from 'kafkajs';
import { logger } from '../utils/logger';

const kafka = new Kafka({
  clientId: 'auth-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  logLevel: logLevel.ERROR
});

export let producer = kafka.producer();

export async function connectKafka() {
  try {
    await producer.connect();
    logger.info('Kafka Producer connected successfully');
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

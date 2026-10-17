import { Kafka, Producer } from 'kafkajs';
import { logger } from '../utils/logger';

const kafkaBrokers = (process.env.KAFKA_BROKERS || 'kafka-1:9092,kafka-2:9092,kafka-3:9092').split(',');

const kafka = new Kafka({
  clientId: 'live-service',
  brokers: kafkaBrokers,
  retry: {
    initialRetryTime: 100,
    retries: 10
  }
});

export const kafkaProducer: Producer = kafka.producer();

export const connectKafka = async (): Promise<void> => {
  try {
    await kafkaProducer.connect();
    logger.info('Live Service Kafka Producer connected');
  } catch (error) {
    logger.warn('Kafka connection warning (will retry in background):', error);
  }
};

import { Kafka, Consumer } from 'kafkajs';
import { logger } from '../utils/logger';
import { encodeVideo } from '../services/encoding.service';

const kafka = new Kafka({
  clientId: 'encoding-service',
  brokers: (process.env.KAFKA_BROKERS || 'kafka-1:9092,kafka-2:9092,kafka-3:9092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 15,
    maxRetryTime: 30000,
    multiplier: 2,
  },
  connectionTimeout: 15000,
  requestTimeout: 30000,
});

let consumer: Consumer;
let isConnecting = false;

export const initializeKafkaConsumer = async () => {
  if (isConnecting) {
    logger.info('Kafka consumer connection already in progress');
    return;
  }

  isConnecting = true;

  try {
    consumer = kafka.consumer({
      groupId: 'encoding-service-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      rebalanceTimeout: 60000,
      allowAutoTopicCreation: false,
    });

    await consumer.connect();
    logger.info('✓ Kafka consumer connected (encoding-service)');

    // Subscribe to video upload topic
    await consumer.subscribe({
      topics: ['video.uploaded'],
      fromBeginning: false
    });

    // Start consuming messages
    await consumer.run({
      partitionsConsumedConcurrently: 2,
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = message.value?.toString();
          if (!value) return;

          const event = JSON.parse(value);
          logger.info(`Received video upload event: ${event.videoId}`);

          // Start encoding in background (don't wait for it)
          encodeVideo(event).catch(err => {
            logger.error(`Encoding failed for ${event.videoId}:`, err);
          });

        } catch (error) {
          logger.error(`Error processing message from ${topic}:`, error);
        }
      }
    });

    logger.info('Encoding Kafka consumer started, listening to video.uploaded');
  } catch (error) {
    logger.error('Failed to initialize Kafka consumer:', error);
    isConnecting = false;
    throw error;
  }
};

export const disconnectConsumer = async () => {
  if (consumer) {
    await consumer.disconnect();
    logger.info('Kafka consumer disconnected');
  }
};

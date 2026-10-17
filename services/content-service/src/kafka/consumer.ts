import { Kafka, Consumer } from 'kafkajs';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { mongoClient } from '../database/mongodb.connection';
import { kafkaProducer } from './producer';

const kafka = new Kafka({
  clientId: 'content-service',
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
      groupId: 'content-service-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      rebalanceTimeout: 60000,
      allowAutoTopicCreation: false,
    });

    await consumer.connect();
    logger.info('✓ Kafka consumer connected (content-service)');

    // Subscribe to encoding completion and progress events
    await consumer.subscribe({
      topics: ['video.encoding.completed', 'video.encoding.failed', 'video.encoding.progress'],
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
          logger.info(`Received ${topic} event for video: ${event.videoId}`);

          if (topic === 'video.encoding.completed') {
            await handleEncodingCompleted(event);
          } else if (topic === 'video.encoding.failed') {
            await handleEncodingFailed(event);
          } else if (topic === 'video.encoding.progress') {
            await handleEncodingProgress(event);
          }

        } catch (error) {
          logger.error(`Error processing message from ${topic}:`, error);
        }
      }
    });

    logger.info('✓ Content-Service Kafka consumer started, listening to encoding events');
  } catch (error) {
    logger.error('Failed to initialize Kafka consumer:', error);
    isConnecting = false;
    throw error;
  }
};

const handleEncodingProgress = async (event: any) => {
  const { videoId, progress } = event;

  try {
    const db = mongoClient.db('ott_platform');
    const videosCollection = db.collection('videos');

    await videosCollection.updateOne(
      { id: videoId },
      {
        $set: {
          processingStage: 'encoding',
          hlsProgress: progress,
          updatedAt: new Date()
        }
      }
    );
  } catch (error) {
    logger.error(`Failed to update video ${videoId} progress:`, error);
  }
};

const handleEncodingCompleted = async (event: any) => {
  const { videoId, title, status, encodingProfiles, profiles } = event;
  const activeProfiles = encodingProfiles || profiles || [];

  try {
    logger.info(`Updating video ${videoId} status to 'ready' with ${activeProfiles.length} profiles`);

    const db = mongoClient.db('ott_platform');
    const videosCollection = db.collection('videos');

    const video = await videosCollection.findOne({ id: videoId });
    const category = video?.category || 'General';
    const videoTitle = video?.title || title || 'Untitled Video';

    const shouldDeleteRaw = event.deletedRawMaster !== undefined
      ? Boolean(event.deletedRawMaster)
      : (process.env.AUTO_DELETE_RAW_AFTER_ENCODE !== 'false');

    const rawVideosDir = process.env.RAW_VIDEOS_DIR || '/videos/raw';
    const rawFilePath = path.join(rawVideosDir, `${videoId}.mp4`);

    if (shouldDeleteRaw && fs.existsSync(rawFilePath)) {
      try {
        const stats = fs.statSync(rawFilePath);
        const reclaimedMB = (stats.size / 1024 / 1024).toFixed(2);
        fs.unlinkSync(rawFilePath);
        logger.info(`✓ Content-service purged raw master file for ${videoId} (${rawFilePath}) - Reclaimed ${reclaimedMB} MB`);
      } catch (delErr) {
        logger.warn(`Could not purge raw file in content-service for ${videoId}:`, delErr);
      }
    }

    const hasRawMaster = fs.existsSync(rawFilePath);

    const updateFields: any = {
      status: 'ready',
      hlsProgress: 100,
      processingStage: 'ready',
      encodingProfiles: activeProfiles,
      localStoragePath: `/videos/encoded/${videoId}`,
      hasRawMaster: hasRawMaster,
      rawFileSize: hasRawMaster ? (video?.rawFileSize || video?.fileSize || 0) : 0,
      rawMasterDeletedAt: !hasRawMaster ? (video?.rawMasterDeletedAt || new Date()) : null,
      updatedAt: new Date()
    };

    const thumbUrl = video?.thumbnail || event?.thumbnail || `/api/stream/${videoId}/thumbnail`;
    updateFields.thumbnail = thumbUrl;
    updateFields.posterImage = video?.posterImage || thumbUrl;

    await videosCollection.updateOne(
      { id: videoId },
      { $set: updateFields }
    );

    logger.info(`✓ Video ${videoId} marked as ready for streaming (hasRawMaster: ${hasRawMaster})`);

    try {
      await kafkaProducer.send({
        topic: 'video.ready',
        messages: [
          {
            key: videoId,
            value: JSON.stringify({
              videoId,
              videoTitle,
              category
            })
          }
        ]
      });
      logger.info(`✓ Published video.ready event for video ${videoId}`);
    } catch (kafkaError) {
      logger.error(`Failed to publish video.ready event for video ${videoId}:`, kafkaError);
    }

  } catch (error) {
    logger.error(`Failed to update video ${videoId} status:`, error);
  }
};

const handleEncodingFailed = async (event: any) => {
  const { videoId, error: errorMessage } = event;

  try {
    logger.error(`Encoding failed for video ${videoId}: ${errorMessage}`);

    const db = mongoClient.db('ott_platform');
    const videosCollection = db.collection('videos');

    await videosCollection.updateOne(
      { id: videoId },
      {
        $set: {
          status: 'failed',
          errorMessage: errorMessage || 'Encoding failed',
          updatedAt: new Date()
        }
      }
    );

    logger.info(`✓ Video ${videoId} marked as failed`);
  } catch (error) {
    logger.error(`Failed to update video ${videoId} error status:`, error);
  }
};

export const disconnectConsumer = async () => {
  if (consumer) {
    await consumer.disconnect();
    logger.info('Kafka consumer disconnected');
  }
};

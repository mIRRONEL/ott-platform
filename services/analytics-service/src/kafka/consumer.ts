import { kafkaConsumer, disconnectKafkaConsumer } from '../config/kafka';
import * as analyticsService from '../services/analytics.service';
import { logger } from '../utils/logger';

const TOPICS = [
  'user.watched',
  'user.paused',
  'user.searched',
  'video.encoding.completed',
  'recommendation.trigger',
  'content.rating.updated'
];

export const initializeKafkaConsumer = async () => {
  try {
    await kafkaConsumer.connect();
    logger.info('Analytics Kafka consumer connected');

    await kafkaConsumer.subscribe({ topics: TOPICS, fromBeginning: false });

    await kafkaConsumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = message.value?.toString();
          if (!value) return;

          const event = JSON.parse(value);

          switch (topic) {
            case 'user.watched':
              await handleUserWatched(event);
              break;
            case 'user.paused':
              await handleUserPaused(event);
              break;
            case 'user.searched':
              await handleUserSearched(event);
              break;
            case 'video.encoding.completed':
              await handleVideoEncodingCompleted(event);
              break;
            case 'recommendation.trigger':
              await handleRecommendationTrigger(event);
              break;
            case 'content.rating.updated':
              await handleContentRatingUpdated(event);
              break;
            default:
              logger.warn(`Unknown topic: ${topic}`);
          }
        } catch (error) {
          logger.error(`Error processing message from ${topic}:`, error);
        }
      }
    });

    logger.info('Analytics Kafka consumer started');
  } catch (error) {
    logger.error('Failed to initialize Kafka consumer:', error);
    throw error;
  }
};

const handleUserWatched = async (event: any) => {
  try {
    logger.info(`Processing user.watched event for user: ${event.userId}`);

    const analyticsEvent = {
      userId: event.userId,
      eventType: 'watch',
      contentId: event.contentId,
      metadata: {
        watchDuration: event.watchDuration || 0,
        completionPercentage: event.completionPercentage || 0,
        quality: event.quality || 'auto',
        device: event.device || 'web',
        contentTitle: event.contentTitle,
        contentCategory: event.contentCategory,
        engagement: calculateEngagement(event)
      },
      timestamp: new Date(event.timestamp),
      sessionId: event.sessionId
    };

    await analyticsService.storeEvent(analyticsEvent);
    logger.info('User watched event stored successfully');
  } catch (error) {
    logger.error('Error handling user.watched event:', error);
  }
};

const handleUserPaused = async (event: any) => {
  try {
    logger.info(`Processing user.paused event for user: ${event.userId}`);

    const analyticsEvent = {
      userId: event.userId,
      eventType: 'pause',
      contentId: event.contentId,
      metadata: {
        lastPosition: event.lastPosition,
        contentTitle: event.contentTitle
      },
      timestamp: new Date(event.timestamp),
      sessionId: event.sessionId
    };

    await analyticsService.storeEvent(analyticsEvent);
  } catch (error) {
    logger.error('Error handling user.paused event:', error);
  }
};

const handleUserSearched = async (event: any) => {
  try {
    logger.info(`Processing user.searched event for user: ${event.userId}`);

    const analyticsEvent = {
      userId: event.userId,
      eventType: 'search',
      contentId: null,
      metadata: {
        searchQuery: event.searchQuery,
        resultsCount: event.resultsCount,
        selectedContentId: event.selectedContentId || null
      },
      timestamp: new Date(event.timestamp),
      sessionId: event.sessionId
    };

    await analyticsService.storeEvent(analyticsEvent);
  } catch (error) {
    logger.error('Error handling user.searched event:', error);
  }
};

const handleVideoEncodingCompleted = async (event: any) => {
  try {
    logger.info(`Processing video encoding completed for content: ${event.contentId}`);

    // Update trending score for newly encoded content
    const analyticsEvent = {
      userId: 'system',
      eventType: 'encoding_completed',
      contentId: event.contentId,
      metadata: {
        encodingQuality: event.encodingQuality,
        fileSize: event.fileSize,
        duration: event.duration
      },
      timestamp: new Date(event.timestamp),
      sessionId: null
    };

    await analyticsService.storeEvent(analyticsEvent);
    logger.info('Video encoding event stored');
  } catch (error) {
    logger.error('Error handling video encoding event:', error);
  }
};

const handleRecommendationTrigger = async (event: any) => {
  try {
    logger.info(`Processing recommendation trigger for user: ${event.userId}`);

    // Log recommendation trigger event for tracking
    const analyticsEvent = {
      userId: event.userId,
      eventType: 'recommendation_trigger',
      contentId: null,
      metadata: {
        triggerType: event.triggerType || 'scheduled',
        context: event.context
      },
      timestamp: new Date(event.timestamp),
      sessionId: null
    };

    await analyticsService.storeEvent(analyticsEvent);
  } catch (error) {
    logger.error('Error handling recommendation trigger event:', error);
  }
};

const handleContentRatingUpdated = async (event: any) => {
  try {
    logger.info(`Processing content rating update for content: ${event.contentId}`);

    const analyticsEvent = {
      userId: event.userId,
      eventType: 'rating',
      contentId: event.contentId,
      metadata: {
        ratingValue: event.ratingValue,
        previousRating: event.previousRating || null
      },
      timestamp: new Date(event.timestamp),
      sessionId: null
    };

    await analyticsService.storeEvent(analyticsEvent);
  } catch (error) {
    logger.error('Error handling content rating updated event:', error);
  }
};

// Helper function to calculate engagement score
const calculateEngagement = (event: any): number => {
  let score = 0;

  // Completion percentage (0-50 points)
  if (event.completionPercentage) {
    score += (event.completionPercentage / 100) * 50;
  }

  // Watch duration (0-30 points)
  if (event.watchDuration) {
    score += Math.min((event.watchDuration / 3600) * 30, 30); // Cap at 30
  }

  // Quality (0-20 points)
  const qualityScores = { '720p': 20, '1080p': 20, '480p': 10, 'auto': 15 };
  score += qualityScores[event.quality as keyof typeof qualityScores] || 0;

  return Math.min(score, 100); // Cap at 100
};

export const stopKafkaConsumer = async () => {
  try {
    await disconnectKafkaConsumer();
    logger.info('Analytics Kafka consumer stopped');
  } catch (error) {
    logger.error('Error stopping Kafka consumer:', error);
  }
};

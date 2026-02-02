"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopKafkaConsumer = exports.initializeKafkaConsumer = void 0;
const kafka_1 = require("../config/kafka");
const analyticsService = __importStar(require("../services/analytics.service"));
const logger_1 = require("../utils/logger");
const TOPICS = [
    'user.watched',
    'user.paused',
    'user.searched',
    'video.encoding.completed',
    'recommendation.trigger',
    'content.rating.updated'
];
const initializeKafkaConsumer = async () => {
    try {
        await kafka_1.kafkaConsumer.connect();
        logger_1.logger.info('Analytics Kafka consumer connected');
        await kafka_1.kafkaConsumer.subscribe({ topics: TOPICS, fromBeginning: false });
        await kafka_1.kafkaConsumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    const value = message.value?.toString();
                    if (!value)
                        return;
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
                            logger_1.logger.warn(`Unknown topic: ${topic}`);
                    }
                }
                catch (error) {
                    logger_1.logger.error(`Error processing message from ${topic}:`, error);
                }
            }
        });
        logger_1.logger.info('Analytics Kafka consumer started');
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize Kafka consumer:', error);
        throw error;
    }
};
exports.initializeKafkaConsumer = initializeKafkaConsumer;
const handleUserWatched = async (event) => {
    try {
        logger_1.logger.info(`Processing user.watched event for user: ${event.userId}`);
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
        logger_1.logger.info('User watched event stored successfully');
    }
    catch (error) {
        logger_1.logger.error('Error handling user.watched event:', error);
    }
};
const handleUserPaused = async (event) => {
    try {
        logger_1.logger.info(`Processing user.paused event for user: ${event.userId}`);
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
    }
    catch (error) {
        logger_1.logger.error('Error handling user.paused event:', error);
    }
};
const handleUserSearched = async (event) => {
    try {
        logger_1.logger.info(`Processing user.searched event for user: ${event.userId}`);
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
    }
    catch (error) {
        logger_1.logger.error('Error handling user.searched event:', error);
    }
};
const handleVideoEncodingCompleted = async (event) => {
    try {
        logger_1.logger.info(`Processing video encoding completed for content: ${event.contentId}`);
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
        logger_1.logger.info('Video encoding event stored');
    }
    catch (error) {
        logger_1.logger.error('Error handling video encoding event:', error);
    }
};
const handleRecommendationTrigger = async (event) => {
    try {
        logger_1.logger.info(`Processing recommendation trigger for user: ${event.userId}`);
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
    }
    catch (error) {
        logger_1.logger.error('Error handling recommendation trigger event:', error);
    }
};
const handleContentRatingUpdated = async (event) => {
    try {
        logger_1.logger.info(`Processing content rating update for content: ${event.contentId}`);
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
    }
    catch (error) {
        logger_1.logger.error('Error handling content rating updated event:', error);
    }
};
// Helper function to calculate engagement score
const calculateEngagement = (event) => {
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
    score += qualityScores[event.quality] || 0;
    return Math.min(score, 100); // Cap at 100
};
const stopKafkaConsumer = async () => {
    try {
        await (0, kafka_1.disconnectKafkaConsumer)();
        logger_1.logger.info('Analytics Kafka consumer stopped');
    }
    catch (error) {
        logger_1.logger.error('Error stopping Kafka consumer:', error);
    }
};
exports.stopKafkaConsumer = stopKafkaConsumer;
//# sourceMappingURL=consumer.js.map
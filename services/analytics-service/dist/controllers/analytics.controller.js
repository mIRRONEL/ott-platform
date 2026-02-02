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
exports.trackEvent = exports.getEngagementMetrics = exports.getContentPerformance = exports.getRecommendations = exports.getTrendingContent = exports.getDashboard = void 0;
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
const analyticsService = __importStar(require("../services/analytics.service"));
const recommendationService = __importStar(require("../services/recommendation.service"));
const redis_1 = require("../config/redis");
// GET /dashboard - Get user analytics dashboard
const getDashboard = async (req, res, next) => {
    try {
        const { userId, startDate, endDate, period = 'month' } = req.query;
        if (!userId || typeof userId !== 'string') {
            throw new errors_1.ValidationError('userId is required');
        }
        const cacheKey = `dashboard:${userId}:${period}`;
        const cachedData = await redis_1.redisClient.get(cacheKey);
        if (cachedData) {
            logger_1.logger.info(`Dashboard retrieved from cache for user: ${userId}`);
            return res.status(200).json(JSON.parse(cachedData));
        }
        const dashboard = await analyticsService.getUserDashboard(userId, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined, period);
        await redis_1.redisClient.setEx(cacheKey, 3600, JSON.stringify(dashboard));
        res.status(200).json(dashboard);
    }
    catch (error) {
        next(error);
    }
};
exports.getDashboard = getDashboard;
// GET /trending - Get trending content
const getTrendingContent = async (req, res, next) => {
    try {
        const { category, limit = 20, period = 'week', sortBy = 'views' } = req.query;
        const cacheKey = `trending:${category || 'all'}:${period}:${sortBy}`;
        const cachedData = await redis_1.redisClient.get(cacheKey);
        if (cachedData) {
            logger_1.logger.info(`Trending content retrieved from cache`);
            return res.status(200).json(JSON.parse(cachedData));
        }
        const trending = await analyticsService.getTrendingContent(category, Number(limit), period, sortBy);
        await redis_1.redisClient.setEx(cacheKey, 1800, JSON.stringify(trending));
        res.status(200).json(trending);
    }
    catch (error) {
        next(error);
    }
};
exports.getTrendingContent = getTrendingContent;
// GET /recommendations/:userId - Get personalized recommendations
const getRecommendations = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { limit = 10, category, algorithm = 'hybrid' } = req.query;
        if (!userId) {
            throw new errors_1.ValidationError('userId is required');
        }
        const cacheKey = `recommendations:${userId}:${algorithm}:${category || 'all'}`;
        const cachedData = await redis_1.redisClient.get(cacheKey);
        if (cachedData) {
            logger_1.logger.info(`Recommendations retrieved from cache for user: ${userId}`);
            return res.status(200).json(JSON.parse(cachedData));
        }
        const recommendations = await recommendationService.getRecommendations(userId, Number(limit), category, algorithm);
        await redis_1.redisClient.setEx(cacheKey, 3600, JSON.stringify(recommendations));
        res.status(200).json(recommendations);
    }
    catch (error) {
        next(error);
    }
};
exports.getRecommendations = getRecommendations;
// GET /performance/:contentId - Get content performance metrics
const getContentPerformance = async (req, res, next) => {
    try {
        const { contentId } = req.params;
        const { startDate, endDate } = req.query;
        if (!contentId) {
            throw new errors_1.ValidationError('contentId is required');
        }
        const cacheKey = `performance:${contentId}`;
        const cachedData = await redis_1.redisClient.get(cacheKey);
        if (cachedData) {
            logger_1.logger.info(`Content performance retrieved from cache for content: ${contentId}`);
            return res.status(200).json(JSON.parse(cachedData));
        }
        const performance = await analyticsService.getContentPerformance(contentId, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
        if (!performance) {
            throw new errors_1.NotFoundError(`No performance data found for content: ${contentId}`);
        }
        await redis_1.redisClient.setEx(cacheKey, 1800, JSON.stringify(performance));
        res.status(200).json(performance);
    }
    catch (error) {
        next(error);
    }
};
exports.getContentPerformance = getContentPerformance;
// GET /engagement/:contentId - Get engagement metrics
const getEngagementMetrics = async (req, res, next) => {
    try {
        const { contentId } = req.params;
        const { metric } = req.query;
        if (!contentId) {
            throw new errors_1.ValidationError('contentId is required');
        }
        const cacheKey = `engagement:${contentId}:${metric || 'all'}`;
        const cachedData = await redis_1.redisClient.get(cacheKey);
        if (cachedData) {
            logger_1.logger.info(`Engagement metrics retrieved from cache for content: ${contentId}`);
            return res.status(200).json(JSON.parse(cachedData));
        }
        const engagement = await analyticsService.getEngagementMetrics(contentId, metric);
        if (!engagement) {
            throw new errors_1.NotFoundError(`No engagement data found for content: ${contentId}`);
        }
        await redis_1.redisClient.setEx(cacheKey, 1800, JSON.stringify(engagement));
        res.status(200).json(engagement);
    }
    catch (error) {
        next(error);
    }
};
exports.getEngagementMetrics = getEngagementMetrics;
// POST /events - Track user events (internal endpoint)
const trackEvent = async (req, res, next) => {
    try {
        const { userId, eventType, contentId, metadata } = req.body;
        if (!userId || !eventType) {
            throw new errors_1.ValidationError('userId and eventType are required');
        }
        const event = {
            userId,
            eventType,
            contentId: contentId || null,
            metadata: metadata || {},
            timestamp: new Date(),
            sessionId: req.headers['x-session-id'] || null
        };
        // Store event asynchronously
        analyticsService.storeEvent(event)
            .catch(err => logger_1.logger.error('Error storing event:', err));
        res.status(202).json({
            message: 'Event received',
            eventId: `${userId}-${Date.now()}`
        });
    }
    catch (error) {
        next(error);
    }
};
exports.trackEvent = trackEvent;
//# sourceMappingURL=analytics.controller.js.map
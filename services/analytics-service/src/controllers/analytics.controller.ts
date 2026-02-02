import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AppError, ValidationError, NotFoundError, DatabaseError } from '../utils/errors';
import * as analyticsService from '../services/analytics.service';
import * as recommendationService from '../services/recommendation.service';
import { redisClient } from '../config/redis';

// GET /dashboard - Get user analytics dashboard
export const getDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, startDate, endDate, period = 'month' } = req.query;

    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('userId is required');
    }

    const cacheKey = `dashboard:${userId}:${period}`;
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      logger.info(`Dashboard retrieved from cache for user: ${userId}`);
      return res.status(200).json(JSON.parse(cachedData));
    }

    const dashboard = await analyticsService.getUserDashboard(
      userId,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined,
      period as string
    );

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(dashboard));

    res.status(200).json(dashboard);
  } catch (error) {
    next(error);
  }
};

// GET /trending - Get trending content
export const getTrendingContent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      category,
      limit = 20,
      period = 'week',
      sortBy = 'views'
    } = req.query;

    const cacheKey = `trending:${category || 'all'}:${period}:${sortBy}`;
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      logger.info(`Trending content retrieved from cache`);
      return res.status(200).json(JSON.parse(cachedData));
    }

    const trending = await analyticsService.getTrendingContent(
      category as string | undefined,
      Number(limit),
      period as string,
      sortBy as string
    );

    await redisClient.setEx(cacheKey, 1800, JSON.stringify(trending));

    res.status(200).json(trending);
  } catch (error) {
    next(error);
  }
};

// GET /recommendations/:userId - Get personalized recommendations
export const getRecommendations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { limit = 10, category, algorithm = 'hybrid' } = req.query;

    if (!userId) {
      throw new ValidationError('userId is required');
    }

    const cacheKey = `recommendations:${userId}:${algorithm}:${category || 'all'}`;
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      logger.info(`Recommendations retrieved from cache for user: ${userId}`);
      return res.status(200).json(JSON.parse(cachedData));
    }

    const recommendations = await recommendationService.getRecommendations(
      userId,
      Number(limit),
      category as string | undefined,
      algorithm as string
    );

    await redisClient.setEx(cacheKey, 3600, JSON.stringify(recommendations));

    res.status(200).json(recommendations);
  } catch (error) {
    next(error);
  }
};

// GET /performance/:contentId - Get content performance metrics
export const getContentPerformance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentId } = req.params;
    const { startDate, endDate } = req.query;

    if (!contentId) {
      throw new ValidationError('contentId is required');
    }

    const cacheKey = `performance:${contentId}`;
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      logger.info(`Content performance retrieved from cache for content: ${contentId}`);
      return res.status(200).json(JSON.parse(cachedData));
    }

    const performance = await analyticsService.getContentPerformance(
      contentId,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    if (!performance) {
      throw new NotFoundError(`No performance data found for content: ${contentId}`);
    }

    await redisClient.setEx(cacheKey, 1800, JSON.stringify(performance));

    res.status(200).json(performance);
  } catch (error) {
    next(error);
  }
};

// GET /engagement/:contentId - Get engagement metrics
export const getEngagementMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentId } = req.params;
    const { metric } = req.query;

    if (!contentId) {
      throw new ValidationError('contentId is required');
    }

    const cacheKey = `engagement:${contentId}:${metric || 'all'}`;
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      logger.info(`Engagement metrics retrieved from cache for content: ${contentId}`);
      return res.status(200).json(JSON.parse(cachedData));
    }

    const engagement = await analyticsService.getEngagementMetrics(
      contentId,
      metric as string | undefined
    );

    if (!engagement) {
      throw new NotFoundError(`No engagement data found for content: ${contentId}`);
    }

    await redisClient.setEx(cacheKey, 1800, JSON.stringify(engagement));

    res.status(200).json(engagement);
  } catch (error) {
    next(error);
  }
};

// POST /events - Track user events (internal endpoint)
export const trackEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, eventType, contentId, metadata } = req.body;

    if (!userId || !eventType) {
      throw new ValidationError('userId and eventType are required');
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
    analyticsService.storeEvent(event as any)
      .catch(err => logger.error('Error storing event:', err));

    res.status(202).json({
      message: 'Event received',
      eventId: `${userId}-${Date.now()}`
    });
  } catch (error) {
    next(error);
  }
};

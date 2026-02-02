import { Router, Request, Response } from 'express';
import { validateRequest } from '../middleware/validation';
import {
  dashboardSchema,
  trendingSchema,
  recommendationsSchema,
  contentPerformanceSchema,
  engagementSchema
} from '../schemas/analytics.schema';
import * as analyticsController from '../controllers/analytics.controller';

const router = Router();

// GET /dashboard - Get user analytics dashboard
router.get(
  '/dashboard',
  validateRequest(dashboardSchema, 'query'),
  analyticsController.getDashboard
);

// GET /trending - Get trending content
router.get(
  '/trending',
  validateRequest(trendingSchema, 'query'),
  analyticsController.getTrendingContent
);

// GET /recommendations/:userId - Get personalized recommendations
router.get(
  '/recommendations/:userId',
  validateRequest(recommendationsSchema, 'params'),
  analyticsController.getRecommendations
);

// GET /performance/:contentId - Get content performance metrics
router.get(
  '/performance/:contentId',
  validateRequest(contentPerformanceSchema, 'params'),
  analyticsController.getContentPerformance
);

// GET /engagement/:contentId - Get engagement metrics
router.get(
  '/engagement/:contentId',
  validateRequest(engagementSchema, 'params'),
  analyticsController.getEngagementMetrics
);

// POST /events - Track user events (internal endpoint)
router.post(
  '/events',
  analyticsController.trackEvent
);

export default router;

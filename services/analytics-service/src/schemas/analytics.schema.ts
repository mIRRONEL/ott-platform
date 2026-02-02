import Joi from 'joi';

export const dashboardSchema = Joi.object({
  userId: Joi.string().required(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  period: Joi.string().valid('day', 'week', 'month').default('month')
});

export const trendingSchema = Joi.object({
  category: Joi.string().optional(),
  limit: Joi.number().min(1).max(100).default(20),
  period: Joi.string().valid('day', 'week', 'month').default('week'),
  sortBy: Joi.string().valid('views', 'rating', 'engagement').default('views')
});

export const recommendationsSchema = Joi.object({
  userId: Joi.string().required(),
  limit: Joi.number().min(1).max(50).default(10),
  category: Joi.string().optional(),
  algorithm: Joi.string().valid('collaborative', 'content-based', 'hybrid').default('hybrid')
});

export const contentPerformanceSchema = Joi.object({
  contentId: Joi.string().required(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional()
});

export const engagementSchema = Joi.object({
  contentId: Joi.string().required(),
  metric: Joi.string().valid('views', 'completion_rate', 'rating', 'reviews').optional()
});

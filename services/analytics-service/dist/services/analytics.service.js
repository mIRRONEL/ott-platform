"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeEvent = exports.getEngagementMetrics = exports.getContentPerformance = exports.getTrendingContent = exports.getUserDashboard = exports.setDatabases = void 0;
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
const moment_1 = __importDefault(require("moment"));
let pgPool;
let mongoDb;
const setDatabases = (pool, db) => {
    pgPool = pool;
    mongoDb = db;
};
exports.setDatabases = setDatabases;
// Get user dashboard with analytics
const getUserDashboard = async (userId, startDate, endDate, period = 'month') => {
    try {
        const start = startDate || (0, moment_1.default)().subtract(1, period).toDate();
        const end = endDate || new Date();
        const eventsCollection = mongoDb.collection('analytics_events');
        const userEventsCollection = mongoDb.collection('user_events');
        // Get watch events
        const watchEvents = await eventsCollection
            .find({
            userId,
            eventType: 'watch',
            timestamp: { $gte: start, $lte: end }
        })
            .toArray();
        // Calculate total watch time
        const totalWatchTime = watchEvents.reduce((sum, event) => {
            return sum + (event.metadata?.watchDuration || 0);
        }, 0);
        // Get unique content watched
        const contentWatched = new Set(watchEvents.map(e => e.contentId)).size;
        // Get categories watched
        const categoryEvents = await eventsCollection
            .aggregate([
            {
                $match: {
                    userId,
                    eventType: 'watch',
                    timestamp: { $gte: start, $lte: end }
                }
            },
            {
                $lookup: {
                    from: 'content',
                    localField: 'contentId',
                    foreignField: '_id',
                    as: 'content'
                }
            },
            {
                $unwind: '$content'
            },
            {
                $group: {
                    _id: '$content.category',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ])
            .toArray();
        const categoriesWatched = categoryEvents.map(c => c._id);
        const favoriteCategories = categoryEvents.map(c => ({
            category: c._id,
            count: c.count
        }));
        // Get watch history
        const watchHistory = await userEventsCollection
            .find({ userId, eventType: 'watch' })
            .sort({ timestamp: -1 })
            .limit(10)
            .toArray();
        // Get continuation data (paused videos)
        const continuationData = await userEventsCollection
            .find({ userId, eventType: 'pause' })
            .toArray();
        // Get user ratings and reviews
        const ratingResult = await pgPool.query('SELECT AVG(rating) as avg_rating, COUNT(*) as content_rated FROM ratings WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3', [userId, start, end]);
        const reviewResult = await pgPool.query('SELECT COUNT(*) as reviews_written FROM reviews WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3', [userId, start, end]);
        return {
            userId,
            totalWatchTime: Math.round(totalWatchTime / 60), // Convert to minutes
            contentWatched,
            categoriesWatched,
            favoriteCategories,
            watchHistory: watchHistory.slice(0, 10).map(e => ({
                contentId: e.contentId,
                title: e.metadata?.contentTitle || 'Unknown',
                watchedAt: e.timestamp
            })),
            continuationData: continuationData.slice(0, 10).map(e => ({
                contentId: e.contentId,
                title: e.metadata?.contentTitle || 'Unknown',
                lastPosition: e.metadata?.lastPosition || 0
            })),
            metrics: {
                avgRating: parseFloat(ratingResult.rows[0]?.avg_rating || 0),
                contentRated: parseInt(ratingResult.rows[0]?.content_rated || 0),
                reviewsWritten: parseInt(reviewResult.rows[0]?.reviews_written || 0)
            }
        };
    }
    catch (error) {
        logger_1.logger.error('Error getting user dashboard:', error);
        throw new errors_1.DatabaseError('Failed to get user dashboard');
    }
};
exports.getUserDashboard = getUserDashboard;
// Get trending content
const getTrendingContent = async (category, limit = 20, period = 'week', sortBy = 'views') => {
    try {
        const startDate = (0, moment_1.default)().subtract(1, period).toDate();
        const eventsCollection = mongoDb.collection('analytics_events');
        const pipeline = [
            {
                $match: {
                    eventType: { $in: ['watch', 'click'] },
                    timestamp: { $gte: startDate }
                }
            }
        ];
        if (category) {
            pipeline.push({
                $lookup: {
                    from: 'content',
                    localField: 'contentId',
                    foreignField: '_id',
                    as: 'content'
                }
            });
            pipeline.push({
                $match: { 'content.category': category }
            });
        }
        pipeline.push({
            $group: {
                _id: '$contentId',
                views: { $sum: 1 },
                avgEngagement: { $avg: '$metadata.engagement' },
                avgRating: { $avg: '$metadata.rating' }
            }
        });
        if (sortBy === 'views') {
            pipeline.push({ $sort: { views: -1 } });
        }
        else if (sortBy === 'rating') {
            pipeline.push({ $sort: { avgRating: -1 } });
        }
        else if (sortBy === 'engagement') {
            pipeline.push({ $sort: { avgEngagement: -1 } });
        }
        pipeline.push({ $limit: limit });
        pipeline.push({
            $lookup: {
                from: 'content',
                localField: '_id',
                foreignField: '_id',
                as: 'contentDetails'
            }
        });
        const trendingContent = await eventsCollection.aggregate(pipeline).toArray();
        return trendingContent.map(item => ({
            contentId: item._id,
            title: item.contentDetails[0]?.title || 'Unknown',
            category: item.contentDetails[0]?.category || 'Unknown',
            views: item.views,
            avgRating: item.avgRating || 0,
            avgEngagement: item.avgEngagement || 0,
            thumbnail: item.contentDetails[0]?.thumbnail || null
        }));
    }
    catch (error) {
        logger_1.logger.error('Error getting trending content:', error);
        throw new errors_1.DatabaseError('Failed to get trending content');
    }
};
exports.getTrendingContent = getTrendingContent;
// Get content performance metrics
const getContentPerformance = async (contentId, startDate, endDate) => {
    try {
        const start = startDate || (0, moment_1.default)().subtract(30, 'days').toDate();
        const end = endDate || new Date();
        const eventsCollection = mongoDb.collection('analytics_events');
        const performance = await eventsCollection.aggregate([
            {
                $match: {
                    contentId,
                    timestamp: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: '$eventType',
                    count: { $sum: 1 }
                }
            }
        ]).toArray();
        if (performance.length === 0) {
            return null;
        }
        const viewCount = performance.find(p => p._id === 'watch')?.count || 0;
        const clickCount = performance.find(p => p._id === 'click')?.count || 0;
        const shareCount = performance.find(p => p._id === 'share')?.count || 0;
        // Get from PostgreSQL for ratings
        const ratingData = await pgPool.query('SELECT COUNT(*) as rating_count, AVG(rating) as avg_rating FROM ratings WHERE content_id = $1 AND created_at >= $2 AND created_at <= $3', [contentId, start, end]);
        const reviewData = await pgPool.query('SELECT COUNT(*) as review_count FROM reviews WHERE content_id = $1 AND created_at >= $2 AND created_at <= $3', [contentId, start, end]);
        return {
            contentId,
            period: { startDate: start, endDate: end },
            views: viewCount,
            clicks: clickCount,
            shares: shareCount,
            ratings: {
                count: parseInt(ratingData.rows[0]?.rating_count || 0),
                average: parseFloat(ratingData.rows[0]?.avg_rating || 0)
            },
            reviews: parseInt(reviewData.rows[0]?.review_count || 0),
            engagementRate: ((clickCount + shareCount) / viewCount * 100).toFixed(2) + '%'
        };
    }
    catch (error) {
        logger_1.logger.error('Error getting content performance:', error);
        throw new errors_1.DatabaseError('Failed to get content performance');
    }
};
exports.getContentPerformance = getContentPerformance;
// Get engagement metrics
const getEngagementMetrics = async (contentId, metric) => {
    try {
        const eventsCollection = mongoDb.collection('analytics_events');
        const allEvents = await eventsCollection
            .find({ contentId })
            .toArray();
        if (allEvents.length === 0) {
            return null;
        }
        const eventTypes = {};
        allEvents.forEach(event => {
            eventTypes[event.eventType] = (eventTypes[event.eventType] || 0) + 1;
        });
        const totalEvents = allEvents.length;
        const completionRate = ((allEvents.filter(e => e.metadata?.watchDuration >= 85).length / totalEvents) * 100).toFixed(2);
        if (metric) {
            return {
                contentId,
                metric,
                count: eventTypes[metric] || 0,
                percentage: ((eventTypes[metric] || 0) / totalEvents * 100).toFixed(2) + '%'
            };
        }
        return {
            contentId,
            totalInteractions: totalEvents,
            completionRate: completionRate + '%',
            engagementBreakdown: Object.entries(eventTypes).map(([type, count]) => ({
                type,
                count,
                percentage: (Number(count) / totalEvents * 100).toFixed(2) + '%'
            }))
        };
    }
    catch (error) {
        logger_1.logger.error('Error getting engagement metrics:', error);
        throw new errors_1.DatabaseError('Failed to get engagement metrics');
    }
};
exports.getEngagementMetrics = getEngagementMetrics;
// Store event for analytics
const storeEvent = async (event) => {
    try {
        const eventsCollection = mongoDb.collection('analytics_events');
        await eventsCollection.insertOne(event);
    }
    catch (error) {
        logger_1.logger.error('Error storing event:', error);
        throw new errors_1.DatabaseError('Failed to store event');
    }
};
exports.storeEvent = storeEvent;
//# sourceMappingURL=analytics.service.js.map
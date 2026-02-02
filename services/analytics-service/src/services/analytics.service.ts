import { Pool } from 'pg';
import { Db, Collection } from 'mongodb';
import { logger } from '../utils/logger';
import { DatabaseError } from '../utils/errors';
import moment from 'moment';

let pgPool: Pool;
let mongoDb: Db;

export const setDatabases = (pool: Pool, db: Db) => {
  pgPool = pool;
  mongoDb = db;
};

interface UserEvent {
  userId: string;
  eventType: string;
  contentId: string | null;
  metadata: Record<string, any>;
  timestamp: Date;
  sessionId: string | null;
}

interface DashboardMetrics {
  userId: string;
  totalWatchTime: number;
  contentWatched: number;
  categoriesWatched: string[];
  favoriteCategories: { category: string; count: number }[];
  watchHistory: Array<{ contentId: string; title: string; watchedAt: Date }>;
  continuationData: Array<{ contentId: string; title: string; lastPosition: number }>;
  metrics: {
    avgRating: number;
    contentRated: number;
    reviewsWritten: number;
  };
}

// Get user dashboard with analytics
export const getUserDashboard = async (
  userId: string,
  startDate?: Date,
  endDate?: Date,
  period: string = 'month'
): Promise<DashboardMetrics> => {
  try {
    const start = startDate || moment().subtract(1, period as any).toDate();
    const end = endDate || new Date();

    const eventsCollection = mongoDb.collection('analytics_events') as any;
    const userEventsCollection = mongoDb.collection('user_events') as any;

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
    const ratingResult = await pgPool.query(
      'SELECT AVG(rating) as avg_rating, COUNT(*) as content_rated FROM ratings WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3',
      [userId, start, end]
    );

    const reviewResult = await pgPool.query(
      'SELECT COUNT(*) as reviews_written FROM reviews WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3',
      [userId, start, end]
    );

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
  } catch (error) {
    logger.error('Error getting user dashboard:', error);
    throw new DatabaseError('Failed to get user dashboard');
  }
};

// Get trending content
export const getTrendingContent = async (
  category?: string,
  limit: number = 20,
  period: string = 'week',
  sortBy: string = 'views'
): Promise<any[]> => {
  try {
    const startDate = moment().subtract(1, period as moment.unitOfTime.DurationConstructor).toDate();
    const eventsCollection = mongoDb.collection('analytics_events');

    const pipeline: any[] = [
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
    } else if (sortBy === 'rating') {
      pipeline.push({ $sort: { avgRating: -1 } });
    } else if (sortBy === 'engagement') {
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
  } catch (error) {
    logger.error('Error getting trending content:', error);
    throw new DatabaseError('Failed to get trending content');
  }
};

// Get content performance metrics
export const getContentPerformance = async (
  contentId: string,
  startDate?: Date,
  endDate?: Date
): Promise<any | null> => {
  try {
    const start = startDate || moment().subtract(30, 'days').toDate();
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
    const ratingData = await pgPool.query(
      'SELECT COUNT(*) as rating_count, AVG(rating) as avg_rating FROM ratings WHERE content_id = $1 AND created_at >= $2 AND created_at <= $3',
      [contentId, start, end]
    );

    const reviewData = await pgPool.query(
      'SELECT COUNT(*) as review_count FROM reviews WHERE content_id = $1 AND created_at >= $2 AND created_at <= $3',
      [contentId, start, end]
    );

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
  } catch (error) {
    logger.error('Error getting content performance:', error);
    throw new DatabaseError('Failed to get content performance');
  }
};

// Get engagement metrics
export const getEngagementMetrics = async (
  contentId: string,
  metric?: string
): Promise<any | null> => {
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
    const completionRate = (
      (allEvents.filter(e => e.metadata?.watchDuration >= 85).length / totalEvents) * 100
    ).toFixed(2);

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
  } catch (error) {
    logger.error('Error getting engagement metrics:', error);
    throw new DatabaseError('Failed to get engagement metrics');
  }
};

// Store event for analytics
export const storeEvent = async (event: UserEvent): Promise<void> => {
  try {
    const eventsCollection = mongoDb.collection('analytics_events');
    await eventsCollection.insertOne(event);
  } catch (error) {
    logger.error('Error storing event:', error);
    throw new DatabaseError('Failed to store event');
  }
};

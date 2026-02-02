import { Pool } from 'pg';
import { Db, Collection } from 'mongodb';
import { logger } from '../utils/logger';
import { DatabaseError } from '../utils/errors';
import * as math from 'mathjs';

let pgPool: Pool;
let mongoDb: Db;

export const setDatabases = (pool: Pool, db: Db) => {
  pgPool = pool;
  mongoDb = db;
};

// Collaborative filtering - user-based recommendations
const getCollaborativeRecommendations = async (
  userId: string,
  limit: number
): Promise<any[]> => {
  try {
    const eventsCollection = mongoDb.collection('analytics_events');
    const contentCollection = mongoDb.collection('content');

    // Get user's watched content
    const userContent = await eventsCollection
      .find({ userId, eventType: 'watch' })
      .project({ contentId: 1 })
      .toArray();

    const userContentIds = userContent.map(e => e.contentId);

    if (userContentIds.length === 0) {
      // New user - return top rated content
      return contentCollection
        .find({})
        .sort({ rating: -1 })
        .limit(limit)
        .toArray();
    }

    // Find similar users (those who watched similar content)
    const similarUsers = await eventsCollection.aggregate([
      {
        $match: {
          eventType: 'watch',
          contentId: { $in: userContentIds },
          userId: { $ne: userId }
        }
      },
      {
        $group: {
          _id: '$userId',
          commonContent: { $sum: 1 }
        }
      },
      {
        $sort: { commonContent: -1 }
      },
      {
        $limit: 10
      }
    ]).toArray();

    // Get content watched by similar users but not by current user
    const similarUserIds = similarUsers.map(su => su._id);
    const recommendations = await eventsCollection.aggregate([
      {
        $match: {
          userId: { $in: similarUserIds },
          eventType: 'watch',
          contentId: { $nin: userContentIds }
        }
      },
      {
        $group: {
          _id: '$contentId',
          score: { $sum: 1 }
        }
      },
      {
        $sort: { score: -1 }
      },
      {
        $limit: limit
      }
    ]).toArray();

    const recommendedContentIds = recommendations.map(r => r._id);
    return contentCollection
      .find({ _id: { $in: recommendedContentIds } })
      .toArray();
  } catch (error) {
    logger.error('Error in collaborative filtering:', error);
    throw new DatabaseError('Failed to generate collaborative recommendations');
  }
};

// Content-based recommendations
const getContentBasedRecommendations = async (
  userId: string,
  limit: number,
  category?: string
): Promise<any[]> => {
  try {
    const eventsCollection = mongoDb.collection('analytics_events');
    const contentCollection = mongoDb.collection('content');

    // Get user's watched content with categories
    const userContent = await eventsCollection.aggregate([
      {
        $match: { userId, eventType: 'watch' }
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
      }
    ]).toArray();

    if (userContent.length === 0) {
      // New user - recommend by category or top rated
      const query: any = {};
      if (category) query.category = category;
      return contentCollection
        .find(query)
        .sort({ rating: -1 })
        .limit(limit)
        .toArray();
    }

    // Get preferred categories
    const categories: Record<string, number> = {};
    const watchedContentIds = new Set<string>();

    userContent.forEach((item: any) => {
      categories[item.content.category] = (categories[item.content.category] || 0) + 1;
      watchedContentIds.add(item.contentId);
    });

    // Find similar content in preferred categories
    const query: any = {
      _id: { $nin: Array.from(watchedContentIds) }
    };

    if (category) {
      query.category = category;
    } else {
      // Get top 2-3 categories
      const topCategories = Object.entries(categories)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([cat]) => cat);
      query.category = { $in: topCategories };
    }

    return contentCollection
      .find(query)
      .sort({ rating: -1 })
      .limit(limit)
      .toArray();
  } catch (error) {
    logger.error('Error in content-based recommendations:', error);
    throw new DatabaseError('Failed to generate content-based recommendations');
  }
};

// Hybrid recommendations (combination of collaborative and content-based)
const getHybridRecommendations = async (
  userId: string,
  limit: number,
  category?: string
): Promise<any[]> => {
  try {
    const collaborative = await getCollaborativeRecommendations(userId, Math.ceil(limit / 2));
    const contentBased = await getContentBasedRecommendations(userId, Math.ceil(limit / 2), category);

    // Merge and deduplicate
    const merged = new Map<string, any>();

    collaborative.forEach(item => {
      merged.set(item._id.toString(), { ...item, score: 1 });
    });

    contentBased.forEach(item => {
      const key = item._id.toString();
      if (merged.has(key)) {
        merged.get(key)!.score += 1;
      } else {
        merged.set(key, { ...item, score: 0.5 });
      }
    });

    // Sort by score and return top items
    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score, ...item }) => item);
  } catch (error) {
    logger.error('Error in hybrid recommendations:', error);
    throw new DatabaseError('Failed to generate hybrid recommendations');
  }
};

// Main recommendation function
export const getRecommendations = async (
  userId: string,
  limit: number = 10,
  category?: string,
  algorithm: string = 'hybrid'
): Promise<{
  userId: string;
  algorithm: string;
  recommendations: any[];
  generatedAt: Date;
}> => {
  try {
    logger.info(`Generating ${algorithm} recommendations for user ${userId}`);

    let recommendations: any[];

    switch (algorithm) {
      case 'collaborative':
        recommendations = await getCollaborativeRecommendations(userId, limit);
        break;
      case 'content-based':
        recommendations = await getContentBasedRecommendations(userId, limit, category);
        break;
      case 'hybrid':
      default:
        recommendations = await getHybridRecommendations(userId, limit, category);
    }

    // Enrich recommendations with user-specific metadata
    const contentCollection = mongoDb.collection('content');
    const enrichedRecommendations = await Promise.all(
      recommendations.map(async (item) => {
        const content = await contentCollection.findOne({ _id: item._id });
        return {
          contentId: item._id,
          title: content?.title,
          description: content?.description,
          category: content?.category,
          rating: content?.rating,
          releaseDate: content?.releaseDate,
          thumbnail: content?.thumbnail,
          duration: content?.duration,
          director: content?.director
        };
      })
    );

    return {
      userId,
      algorithm,
      recommendations: enrichedRecommendations,
      generatedAt: new Date()
    };
  } catch (error) {
    logger.error('Error generating recommendations:', error);
    throw new DatabaseError('Failed to generate recommendations');
  }
};

// Get trending recommendations (curated by platform)
export const getTrendingRecommendations = async (limit: number = 20): Promise<any[]> => {
  try {
    const contentCollection = mongoDb.collection('content');

    return contentCollection
      .find({})
      .sort({ trendingScore: -1, rating: -1 })
      .limit(limit)
      .toArray();
  } catch (error) {
    logger.error('Error getting trending recommendations:', error);
    throw new DatabaseError('Failed to get trending recommendations');
  }
};

// Get personalized daily recommendations
export const getPersonalizedDailyRecommendations = async (
  userId: string,
  limit: number = 5
): Promise<any[]> => {
  try {
    const cacheKey = `daily-rec:${userId}:${new Date().toDateString()}`;

    // Generate hybrid recommendations
    const recommendations = await getHybridRecommendations(userId, limit);

    return recommendations;
  } catch (error) {
    logger.error('Error getting personalized daily recommendations:', error);
    throw new DatabaseError('Failed to get personalized daily recommendations');
  }
};

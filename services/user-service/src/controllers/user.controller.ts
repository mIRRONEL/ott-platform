import { Request, Response, NextFunction } from 'express';
import { pool } from '../database/connection';
import { mongoClient } from '../database/mongodb.connection';
import { kafkaProducer } from '../kafka/producer';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { AppError, ValidationError, NotFoundError, DatabaseError } from '../utils/errors';

/**
 * Get user profile
 */
export const getUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    // Check Redis cache first (if available)
    try {
      if (redisClient.isOpen) {
        const cachedUser = await redisClient.get(`user:${userId}`);
        if (cachedUser) {
          logger.info(`User profile retrieved from cache: ${userId}`);
          res.status(200).json({
            status: 'success',
            data: JSON.parse(cachedUser),
            source: 'cache'
          });
          return;
        }
      }
    } catch (redisError) {
      // Redis unavailable, continue to database
      logger.warn('Redis cache unavailable, fetching from database');
    }

    // Get from PostgreSQL
    const query = `
      SELECT 
        id,
        email,
        first_name,
        last_name,
        country,
        role,
        is_banned,
        status,
        created_at,
        updated_at,
        last_login
      FROM users
      WHERE id = $1 AND status = 'active'
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    const user = result.rows[0];

    // Cache the user profile for 1 hour (if Redis available)
    try {
      if (redisClient.isOpen) {
        await redisClient.setEx(
          `user:${userId}`,
          3600,
          JSON.stringify(user)
        );
      }
    } catch (redisError) {
      // Redis unavailable, cache write failed - not critical
      logger.warn('Failed to cache user profile, continuing...');
    }

    logger.info(`User profile retrieved: ${userId}`);

    res.status(200).json({
      status: 'success',
      data: user,
      source: 'database'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const {
      firstName,
      lastName,
      email,
      phone,
      bio,
      profileImage,
      dateOfBirth,
      country,
      city
    } = req.body;

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (firstName !== undefined) {
      updates.push(`first_name = $${paramCount}`);
      values.push(firstName);
      paramCount++;
    }
    if (lastName !== undefined) {
      updates.push(`last_name = $${paramCount}`);
      values.push(lastName);
      paramCount++;
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount}`);
      values.push(email);
      paramCount++;
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount}`);
      values.push(phone);
      paramCount++;
    }
    if (bio !== undefined) {
      updates.push(`bio = $${paramCount}`);
      values.push(bio);
      paramCount++;
    }
    if (profileImage !== undefined) {
      updates.push(`profile_image = $${paramCount}`);
      values.push(profileImage);
      paramCount++;
    }
    if (dateOfBirth !== undefined) {
      updates.push(`date_of_birth = $${paramCount}`);
      values.push(dateOfBirth);
      paramCount++;
    }
    if (country !== undefined) {
      updates.push(`country = $${paramCount}`);
      values.push(country);
      paramCount++;
    }
    if (city !== undefined) {
      updates.push(`city = $${paramCount}`);
      values.push(city);
      paramCount++;
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update');
    }

    updates.push(`updated_at = NOW()`);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, first_name, last_name, phone, bio, profile_image, 
                date_of_birth, country, city, updated_at
    `;

    values.push(userId);

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    const updatedUser = result.rows[0];

    // Invalidate cache
    await redisClient.del(`user:${userId}`);

    // Publish Kafka event
    await kafkaProducer.send({
      topic: 'user.profile.updated',
      messages: [
        {
          key: userId,
          value: JSON.stringify({
            userId,
            changes: {
              firstName,
              lastName,
              email,
              phone,
              bio,
              profileImage,
              dateOfBirth,
              country,
              city
            },
            timestamp: new Date().toISOString(),
            eventId: `${userId}-${Date.now()}`
          })
        }
      ]
    });

    logger.info(`User profile updated: ${userId}`);

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user account
 */
export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    // Soft delete - mark as inactive
    const query = `
      UPDATE users
      SET status = 'inactive', updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, status
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    // Invalidate cache
    await redisClient.del(`user:${userId}`);

    // Publish Kafka event
    await kafkaProducer.send({
      topic: 'user.deleted',
      messages: [
        {
          key: userId,
          value: JSON.stringify({
            userId,
            deletedAt: new Date().toISOString(),
            eventId: `${userId}-${Date.now()}`
          })
        }
      ]
    });

    logger.info(`User deleted (soft): ${userId}`);

    res.status(200).json({
      status: 'success',
      message: 'User account deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add video to watchlist
 */
export const addToWatchlist = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { videoId, title, thumbnail, category } = req.body;

    const mongoDb = mongoClient.db('ott_platform');
    const watchlistCollection = mongoDb.collection('watchlist');

    // Check if already in watchlist
    const existing = await watchlistCollection.findOne({
      userId,
      videoId
    });

    if (existing) {
      throw new ValidationError('Video already in watchlist');
    }

    // Add to watchlist
    const result = await watchlistCollection.insertOne({
      userId,
      videoId,
      title,
      thumbnail,
      category,
      addedAt: new Date(),
      position: 0 // Watch position
    });

    logger.info(`Video added to watchlist: ${userId} - ${videoId}`);

    res.status(201).json({
      status: 'success',
      message: 'Video added to watchlist',
      data: {
        _id: result.insertedId,
        userId,
        videoId,
        addedAt: new Date()
      }
    });

    // Background cleanup (fire-and-forget)
    setImmediate(() => {
      redisClient.del(`watchlist:${userId}`)
        .catch(err => logger.warn('Failed to invalidate watchlist cache', err));

      if (kafkaProducer) {
        kafkaProducer.send({
          topic: 'user.watchlist.added',
          messages: [{
            key: userId,
            value: JSON.stringify({
              userId,
              videoId,
              title,
              timestamp: new Date().toISOString(),
              eventId: `${userId}-${videoId}-${Date.now()}`
            })
          }]
        }).catch(err => logger.warn('Failed to publish watchlist.added event', err));
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove video from watchlist
 */
export const removeFromWatchlist = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId, videoId } = req.params;

    const mongoDb = mongoClient.db('ott_platform');
    const watchlistCollection = mongoDb.collection('watchlist');

    const result = await watchlistCollection.deleteOne({
      userId,
      videoId
    });

    if (result.deletedCount === 0) {
      throw new NotFoundError('Video not found in watchlist');
    }

    logger.info(`Video removed from watchlist: ${userId} - ${videoId}`);

    res.status(200).json({
      status: 'success',
      message: 'Video removed from watchlist'
    });

    // Background cleanup (fire-and-forget)
    setImmediate(() => {
      redisClient.del(`watchlist:${userId}`)
        .catch(err => logger.warn('Failed to invalidate watchlist cache', err));

      if (kafkaProducer) {
        kafkaProducer.send({
          topic: 'user.watchlist.removed',
          messages: [{
            key: userId,
            value: JSON.stringify({
              userId,
              videoId,
              timestamp: new Date().toISOString(),
              eventId: `${userId}-${videoId}-${Date.now()}`
            })
          }]
        }).catch(err => logger.warn('Failed to publish watchlist.removed event', err));
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user watchlist
 */
export const getWatchlist = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Check cache first
    const cachedWatchlist = await redisClient.get(`watchlist:${userId}`);
    if (cachedWatchlist) {
      logger.info(`Watchlist retrieved from cache: ${userId}`);
      res.status(200).json({
        status: 'success',
        data: JSON.parse(cachedWatchlist),
        source: 'cache'
      });
      return;
    }

    const mongoDb = mongoClient.db('ott_platform');
    const watchlistCollection = mongoDb.collection('watchlist');

    const skip = ((Number(page) - 1) * Number(limit));
    const sort = { addedAt: -1 };

    const watchlist = await watchlistCollection
      .find({ userId })
      .sort(sort as any)
      .skip(skip)
      .limit(Number(limit))
      .toArray();

    const total = await watchlistCollection.countDocuments({ userId });

    const response = {
      status: 'success',
      data: watchlist,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      },
      source: 'database'
    };

    // Cache for 30 minutes
    await redisClient.setEx(
      `watchlist:${userId}`,
      1800,
      JSON.stringify(response.data)
    );

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Update user preferences
 */
export const updatePreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const preferences = req.body;

    const mongoDb = mongoClient.db('ott_platform');
    const preferencesCollection = mongoDb.collection('user_preferences');

    const result = await preferencesCollection.updateOne(
      { userId },
      {
        $set: {
          ...preferences,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    // Invalidate cache
    await redisClient.del(`preferences:${userId}`);

    // Publish Kafka event
    await kafkaProducer.send({
      topic: 'user.preferences.updated',
      messages: [
        {
          key: userId,
          value: JSON.stringify({
            userId,
            preferences,
            timestamp: new Date().toISOString(),
            eventId: `${userId}-${Date.now()}`
          })
        }
      ]
    });

    logger.info(`User preferences updated: ${userId}`);

    res.status(200).json({
      status: 'success',
      message: 'Preferences updated successfully',
      data: preferences
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user preferences
 */
export const getPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    // Check cache first
    const cachedPreferences = await redisClient.get(`preferences:${userId}`);
    if (cachedPreferences) {
      logger.info(`Preferences retrieved from cache: ${userId}`);
      res.status(200).json({
        status: 'success',
        data: JSON.parse(cachedPreferences),
        source: 'cache'
      });
      return;
    }

    const mongoDb = mongoClient.db('ott_platform');
    const preferencesCollection = mongoDb.collection('user_preferences');

    const preferences = await preferencesCollection.findOne({ userId });

    if (!preferences) {
      // Return default preferences
      const defaults = {
        language: 'en',
        subtitles: true,
        subtitleLanguage: 'en',
        defaultQuality: '1080p',
        autoPlay: true,
        autoPlayNextEpisode: false,
        theme: 'dark',
        notifications: {
          newRelease: true,
          subscription: true,
          recommendations: true,
          newsletter: false
        }
      };

      res.status(200).json({
        status: 'success',
        data: defaults,
        message: 'Default preferences returned'
      });
      return;
    }

    // Cache for 1 hour
    await redisClient.setEx(
      `preferences:${userId}`,
      3600,
      JSON.stringify(preferences)
    );

    res.status(200).json({
      status: 'success',
      data: preferences,
      source: 'database'
    });
  } catch (error) {
    next(error);
  }
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPreferences = exports.updatePreferences = exports.getWatchlist = exports.removeFromWatchlist = exports.addToWatchlist = exports.deleteUser = exports.updateUserProfile = exports.getUserProfile = void 0;
const connection_1 = require("../database/connection");
const mongodb_connection_1 = require("../database/mongodb.connection");
const producer_1 = require("../kafka/producer");
const redis_1 = require("../config/redis");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
/**
 * Get user profile
 */
const getUserProfile = async (req, res, next) => {
    try {
        const { userId } = req.params;
        // Check Redis cache first
        const cachedUser = await redis_1.redisClient.get(`user:${userId}`);
        if (cachedUser) {
            logger_1.logger.info(`User profile retrieved from cache: ${userId}`);
            res.status(200).json({
                status: 'success',
                data: JSON.parse(cachedUser),
                source: 'cache'
            });
            return;
        }
        // Get from PostgreSQL
        const query = `
      SELECT 
        id,
        email,
        first_name,
        last_name,
        phone,
        bio,
        profile_image,
        date_of_birth,
        country,
        city,
        status,
        created_at,
        updated_at
      FROM users
      WHERE id = $1 AND status = 'active'
    `;
        const result = await connection_1.pool.query(query, [userId]);
        if (result.rows.length === 0) {
            throw new errors_1.NotFoundError('User not found');
        }
        const user = result.rows[0];
        // Cache the user profile for 1 hour
        await redis_1.redisClient.setEx(`user:${userId}`, 3600, JSON.stringify(user));
        logger_1.logger.info(`User profile retrieved: ${userId}`);
        res.status(200).json({
            status: 'success',
            data: user,
            source: 'database'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getUserProfile = getUserProfile;
/**
 * Update user profile
 */
const updateUserProfile = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { firstName, lastName, email, phone, bio, profileImage, dateOfBirth, country, city } = req.body;
        // Build dynamic UPDATE query
        const updates = [];
        const values = [];
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
            throw new errors_1.ValidationError('No fields to update');
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
        const result = await connection_1.pool.query(query, values);
        if (result.rows.length === 0) {
            throw new errors_1.NotFoundError('User not found');
        }
        const updatedUser = result.rows[0];
        // Invalidate cache
        await redis_1.redisClient.del(`user:${userId}`);
        // Publish Kafka event
        await producer_1.kafkaProducer.send({
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
        logger_1.logger.info(`User profile updated: ${userId}`);
        res.status(200).json({
            status: 'success',
            message: 'Profile updated successfully',
            data: updatedUser
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateUserProfile = updateUserProfile;
/**
 * Delete user account
 */
const deleteUser = async (req, res, next) => {
    try {
        const { userId } = req.params;
        // Soft delete - mark as inactive
        const query = `
      UPDATE users
      SET status = 'inactive', updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, status
    `;
        const result = await connection_1.pool.query(query, [userId]);
        if (result.rows.length === 0) {
            throw new errors_1.NotFoundError('User not found');
        }
        // Invalidate cache
        await redis_1.redisClient.del(`user:${userId}`);
        // Publish Kafka event
        await producer_1.kafkaProducer.send({
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
        logger_1.logger.info(`User deleted (soft): ${userId}`);
        res.status(200).json({
            status: 'success',
            message: 'User account deleted successfully'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteUser = deleteUser;
/**
 * Add video to watchlist
 */
const addToWatchlist = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { videoId, title, thumbnail, category } = req.body;
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const watchlistCollection = mongoDb.collection('watchlist');
        // Check if already in watchlist
        const existing = await watchlistCollection.findOne({
            userId,
            videoId
        });
        if (existing) {
            throw new errors_1.ValidationError('Video already in watchlist');
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
        // Invalidate watchlist cache
        await redis_1.redisClient.del(`watchlist:${userId}`);
        // Publish Kafka event
        await producer_1.kafkaProducer.send({
            topic: 'user.watchlist.added',
            messages: [
                {
                    key: userId,
                    value: JSON.stringify({
                        userId,
                        videoId,
                        title,
                        timestamp: new Date().toISOString(),
                        eventId: `${userId}-${videoId}-${Date.now()}`
                    })
                }
            ]
        });
        logger_1.logger.info(`Video added to watchlist: ${userId} - ${videoId}`);
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
    }
    catch (error) {
        next(error);
    }
};
exports.addToWatchlist = addToWatchlist;
/**
 * Remove video from watchlist
 */
const removeFromWatchlist = async (req, res, next) => {
    try {
        const { userId, videoId } = req.params;
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const watchlistCollection = mongoDb.collection('watchlist');
        const result = await watchlistCollection.deleteOne({
            userId,
            videoId
        });
        if (result.deletedCount === 0) {
            throw new errors_1.NotFoundError('Video not found in watchlist');
        }
        // Invalidate cache
        await redis_1.redisClient.del(`watchlist:${userId}`);
        // Publish Kafka event
        await producer_1.kafkaProducer.send({
            topic: 'user.watchlist.removed',
            messages: [
                {
                    key: userId,
                    value: JSON.stringify({
                        userId,
                        videoId,
                        timestamp: new Date().toISOString(),
                        eventId: `${userId}-${videoId}-${Date.now()}`
                    })
                }
            ]
        });
        logger_1.logger.info(`Video removed from watchlist: ${userId} - ${videoId}`);
        res.status(200).json({
            status: 'success',
            message: 'Video removed from watchlist'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.removeFromWatchlist = removeFromWatchlist;
/**
 * Get user watchlist
 */
const getWatchlist = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        // Check cache first
        const cachedWatchlist = await redis_1.redisClient.get(`watchlist:${userId}`);
        if (cachedWatchlist) {
            logger_1.logger.info(`Watchlist retrieved from cache: ${userId}`);
            res.status(200).json({
                status: 'success',
                data: JSON.parse(cachedWatchlist),
                source: 'cache'
            });
            return;
        }
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const watchlistCollection = mongoDb.collection('watchlist');
        const skip = ((Number(page) - 1) * Number(limit));
        const sort = { addedAt: -1 };
        const watchlist = await watchlistCollection
            .find({ userId })
            .sort(sort)
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
        await redis_1.redisClient.setEx(`watchlist:${userId}`, 1800, JSON.stringify(response.data));
        res.status(200).json(response);
    }
    catch (error) {
        next(error);
    }
};
exports.getWatchlist = getWatchlist;
/**
 * Update user preferences
 */
const updatePreferences = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const preferences = req.body;
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const preferencesCollection = mongoDb.collection('user_preferences');
        const result = await preferencesCollection.updateOne({ userId }, {
            $set: {
                ...preferences,
                updatedAt: new Date()
            }
        }, { upsert: true });
        // Invalidate cache
        await redis_1.redisClient.del(`preferences:${userId}`);
        // Publish Kafka event
        await producer_1.kafkaProducer.send({
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
        logger_1.logger.info(`User preferences updated: ${userId}`);
        res.status(200).json({
            status: 'success',
            message: 'Preferences updated successfully',
            data: preferences
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updatePreferences = updatePreferences;
/**
 * Get user preferences
 */
const getPreferences = async (req, res, next) => {
    try {
        const { userId } = req.params;
        // Check cache first
        const cachedPreferences = await redis_1.redisClient.get(`preferences:${userId}`);
        if (cachedPreferences) {
            logger_1.logger.info(`Preferences retrieved from cache: ${userId}`);
            res.status(200).json({
                status: 'success',
                data: JSON.parse(cachedPreferences),
                source: 'cache'
            });
            return;
        }
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
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
        await redis_1.redisClient.setEx(`preferences:${userId}`, 3600, JSON.stringify(preferences));
        res.status(200).json({
            status: 'success',
            data: preferences,
            source: 'database'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getPreferences = getPreferences;
//# sourceMappingURL=user.controller.js.map
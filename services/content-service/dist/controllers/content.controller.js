"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateVideo = exports.getComments = exports.addComment = exports.getRatedVideos = exports.getTrendingContent = exports.getCategories = exports.searchVideos = exports.deleteVideo = exports.updateVideo = exports.getVideoById = exports.createVideo = exports.getAllVideos = exports.uploadVideo = void 0;
const uuid_1 = require("uuid");
const fs_1 = __importDefault(require("fs"));
const mongodb_connection_1 = require("../database/mongodb.connection");
const elasticsearch_connection_1 = require("../database/elasticsearch.connection");
const producer_1 = require("../kafka/producer");
const redis_1 = require("../config/redis");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
/**
 * Upload video file
 */
const uploadVideo = async (req, res, next) => {
    try {
        if (!req.file) {
            throw new errors_1.ValidationError('No video file provided');
        }
        const { title, description, category, subCategory } = req.body;
        if (!title) {
            // Delete uploaded file if validation fails
            fs_1.default.unlinkSync(req.file.path);
            throw new errors_1.ValidationError('Video title is required');
        }
        const videoId = (0, uuid_1.v4)();
        const videoData = {
            id: videoId,
            title,
            description: description || '',
            category: category || 'General',
            subCategory: subCategory || 'Other',
            fileName: req.file.filename,
            filePath: `/uploads/videos/${req.file.filename}`,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,
            duration: 0, // Will be updated by streaming service
            thumbnail: null,
            posterImage: null,
            status: 'processing',
            uploadedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        };
        // Save to MongoDB
        const db = mongodb_connection_1.mongoClient.db('ott_platform');
        const videosCollection = db.collection('videos');
        await videosCollection.insertOne(videoData);
        // Publish event to Kafka
        if (producer_1.kafkaProducer) {
            try {
                await producer_1.kafkaProducer.send({
                    topic: 'video.uploaded',
                    messages: [
                        {
                            key: videoId,
                            value: JSON.stringify({
                                videoId,
                                fileName: req.file.filename,
                                filePath: videoData.filePath,
                                mimeType: req.file.mimetype,
                                fileSize: req.file.size,
                                title,
                                timestamp: new Date().toISOString()
                            })
                        }
                    ]
                });
            }
            catch (kafkaError) {
                logger_1.logger.warn('Failed to publish video.uploaded event to Kafka', kafkaError);
            }
        }
        logger_1.logger.info(`Video uploaded successfully: ${videoId}`);
        res.status(201).json({
            success: true,
            message: 'Video uploaded successfully',
            data: {
                videoId,
                fileName: req.file.filename,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                status: 'processing',
                uploadedAt: videoData.uploadedAt
            }
        });
    }
    catch (error) {
        // Clean up uploaded file on error
        if (req.file) {
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch (unlinkError) {
                logger_1.logger.warn('Failed to delete uploaded file', unlinkError);
            }
        }
        logger_1.logger.error('Video upload error:', error);
        next(error);
    }
};
exports.uploadVideo = uploadVideo;
/**
 * Get all videos with pagination
 */
const getAllVideos = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        try {
            const db = mongodb_connection_1.mongoClient.db('ott_platform');
            const videosCollection = db.collection('videos');
            // Get total count
            const total = await videosCollection.countDocuments();
            // Get videos with pagination
            const videos = await videosCollection
                .find({})
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray();
            const totalPages = Math.ceil(total / limit);
            res.status(200).json({
                success: true,
                message: 'Videos retrieved successfully',
                data: {
                    videos,
                    pagination: {
                        currentPage: page,
                        totalPages,
                        totalCount: total,
                        pageSize: limit
                    }
                }
            });
        }
        catch (dbError) {
            logger_1.logger.error('Database error:', dbError);
            // Return empty result instead of error
            res.status(200).json({
                success: true,
                message: 'No videos available',
                data: {
                    videos: [],
                    pagination: {
                        currentPage: page,
                        totalPages: 0,
                        totalCount: 0,
                        pageSize: limit
                    }
                }
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Get all videos error:', error);
        next(error);
    }
};
exports.getAllVideos = getAllVideos;
/**
 * Create a new video
 */
const createVideo = async (req, res, next) => {
    try {
        const videoId = (0, uuid_1.v4)();
        const { title, description, thumbnail, posterImage, duration, category, subCategory, releaseDate, director, cast, language, subtitle, contentRating, imdbRating, videoUrl, videoQuality, isActive = true, tags = [] } = req.body;
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const videosCollection = mongoDb.collection('videos');
        const videoData = {
            _id: videoId,
            title,
            description,
            thumbnail,
            posterImage,
            duration,
            category,
            subCategory,
            releaseDate: new Date(releaseDate),
            director,
            cast,
            language,
            subtitle,
            contentRating,
            imdbRating,
            videoUrl,
            videoQuality,
            isActive,
            tags,
            views: 0,
            rating: 0,
            reviewCount: 0,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        // Insert into MongoDB
        await videosCollection.insertOne(videoData);
        // Index in Elasticsearch for search
        await elasticsearch_connection_1.elasticsearchClient.index({
            index: 'videos',
            id: videoId,
            document: {
                videoId,
                title,
                description,
                category,
                subCategory,
                cast,
                director,
                tags,
                imdbRating,
                releaseDate: new Date(releaseDate)
            }
        });
        // Publish Kafka event
        await producer_1.kafkaProducer.send({
            topic: 'video.uploaded',
            messages: [
                {
                    key: videoId,
                    value: JSON.stringify({
                        videoId,
                        title,
                        category,
                        timestamp: new Date().toISOString(),
                        eventId: `${videoId}-${Date.now()}`
                    })
                }
            ]
        });
        logger_1.logger.info(`Video created: ${videoId} - ${title}`);
        res.status(201).json({
            status: 'success',
            message: 'Video created successfully',
            data: videoData
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createVideo = createVideo;
/**
 * Get video by ID
 */
const getVideoById = async (req, res, next) => {
    try {
        const { videoId } = req.params;
        // Check cache first
        const cachedVideo = await redis_1.redisClient.get(`video:${videoId}`);
        if (cachedVideo) {
            logger_1.logger.info(`Video retrieved from cache: ${videoId}`);
            res.status(200).json({
                status: 'success',
                data: JSON.parse(cachedVideo),
                source: 'cache'
            });
            return;
        }
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const videosCollection = mongoDb.collection('videos');
        const video = await videosCollection.findOne({ _id: videoId });
        if (!video) {
            throw new errors_1.NotFoundError('Video not found');
        }
        // Increment views
        await videosCollection.updateOne({ _id: videoId }, { $inc: { views: 1 } });
        // Cache for 30 minutes
        await redis_1.redisClient.setEx(`video:${videoId}`, 1800, JSON.stringify(video));
        logger_1.logger.info(`Video retrieved: ${videoId}`);
        res.status(200).json({
            status: 'success',
            data: video,
            source: 'database'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getVideoById = getVideoById;
/**
 * Update video metadata
 */
const updateVideo = async (req, res, next) => {
    try {
        const { videoId } = req.params;
        const updates = req.body;
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const videosCollection = mongoDb.collection('videos');
        const result = await videosCollection.findOneAndUpdate({ _id: videoId }, {
            $set: {
                ...updates,
                updatedAt: new Date()
            }
        }, { returnDocument: 'after' });
        if (!result.value) {
            throw new errors_1.NotFoundError('Video not found');
        }
        // Invalidate cache
        await redis_1.redisClient.del(`video:${videoId}`);
        // Update Elasticsearch
        await elasticsearch_connection_1.elasticsearchClient.update({
            index: 'videos',
            id: videoId,
            doc: {
                ...updates,
                updatedAt: new Date()
            }
        });
        // Publish Kafka event
        await producer_1.kafkaProducer.send({
            topic: 'video.updated',
            messages: [
                {
                    key: videoId,
                    value: JSON.stringify({
                        videoId,
                        changes: updates,
                        timestamp: new Date().toISOString(),
                        eventId: `${videoId}-${Date.now()}`
                    })
                }
            ]
        });
        logger_1.logger.info(`Video updated: ${videoId}`);
        res.status(200).json({
            status: 'success',
            message: 'Video updated successfully',
            data: result.value
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateVideo = updateVideo;
/**
 * Delete video
 */
const deleteVideo = async (req, res, next) => {
    try {
        const { videoId } = req.params;
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const videosCollection = mongoDb.collection('videos');
        const result = await videosCollection.deleteOne({ _id: videoId });
        if (result.deletedCount === 0) {
            throw new errors_1.NotFoundError('Video not found');
        }
        // Invalidate cache
        await redis_1.redisClient.del(`video:${videoId}`);
        // Delete from Elasticsearch
        await elasticsearch_connection_1.elasticsearchClient.delete({
            index: 'videos',
            id: videoId
        });
        // Publish Kafka event
        await producer_1.kafkaProducer.send({
            topic: 'video.deleted',
            messages: [
                {
                    key: videoId,
                    value: JSON.stringify({
                        videoId,
                        timestamp: new Date().toISOString(),
                        eventId: `${videoId}-${Date.now()}`
                    })
                }
            ]
        });
        logger_1.logger.info(`Video deleted: ${videoId}`);
        res.status(200).json({
            status: 'success',
            message: 'Video deleted successfully'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteVideo = deleteVideo;
/**
 * Search videos
 */
const searchVideos = async (req, res, next) => {
    try {
        const { q, category, page = 1, limit = 20, sortBy = 'relevance' } = req.query;
        // Elasticsearch search
        const searchQuery = {
            bool: {
                must: [
                    {
                        multi_match: {
                            query: q,
                            fields: ['title^2', 'description', 'cast', 'director', 'tags']
                        }
                    }
                ]
            }
        };
        if (category) {
            searchQuery.bool.filter = {
                term: { category: category }
            };
        }
        const sortMap = {
            relevance: [{ _score: { order: 'desc' } }],
            rating: [{ imdbRating: { order: 'desc' } }],
            newest: [{ releaseDate: { order: 'desc' } }],
            trending: [{ views: { order: 'desc' } }]
        };
        const response = await elasticsearch_connection_1.elasticsearchClient.search({
            index: 'videos',
            body: {
                query: searchQuery,
                sort: sortMap[sortBy] || sortMap.relevance,
                from: (Number(page) - 1) * Number(limit),
                size: Number(limit)
            }
        });
        const results = response.hits.hits.map((hit) => ({
            ...hit._source,
            score: hit._score
        }));
        logger_1.logger.info(`Videos searched: ${q}, found ${(typeof response.hits.total === "number" ? response.hits.total : response.hits.total.value)}`);
        res.status(200).json({
            status: 'success',
            data: results,
            pagination: {
                total: (typeof response.hits.total === "number" ? response.hits.total : response.hits.total.value),
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil((typeof response.hits.total === "number" ? response.hits.total : response.hits.total.value) / Number(limit))
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.searchVideos = searchVideos;
/**
 * Get all categories
 */
const getCategories = async (req, res, next) => {
    try {
        // Check cache
        const cachedCategories = await redis_1.redisClient.get('categories');
        if (cachedCategories) {
            res.status(200).json({
                status: 'success',
                data: JSON.parse(cachedCategories),
                source: 'cache'
            });
            return;
        }
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const videosCollection = mongoDb.collection('videos');
        const categories = await videosCollection
            .aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ])
            .toArray();
        // Cache for 1 hour
        await redis_1.redisClient.setEx('categories', 3600, JSON.stringify(categories));
        logger_1.logger.info(`Categories retrieved: ${categories.length}`);
        res.status(200).json({
            status: 'success',
            data: categories,
            source: 'database'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getCategories = getCategories;
/**
 * Get trending content
 */
const getTrendingContent = async (req, res, next) => {
    try {
        // Check cache
        const cachedTrending = await redis_1.redisClient.get('trending');
        if (cachedTrending) {
            res.status(200).json({
                status: 'success',
                data: JSON.parse(cachedTrending),
                source: 'cache'
            });
            return;
        }
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const videosCollection = mongoDb.collection('videos');
        const analyticsCollection = mongoDb.collection('analytics');
        // Get top viewed videos from last 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const trendingVideos = await videosCollection
            .find({ isActive: true })
            .sort({ views: -1 })
            .limit(20)
            .toArray();
        // Cache for 6 hours
        await redis_1.redisClient.setEx('trending', 21600, JSON.stringify(trendingVideos));
        logger_1.logger.info(`Trending content retrieved: ${trendingVideos.length}`);
        res.status(200).json({
            status: 'success',
            data: trendingVideos,
            source: 'database'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getTrendingContent = getTrendingContent;
/**
 * Get video ratings and reviews
 */
const getRatedVideos = async (req, res, next) => {
    try {
        const { videoId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const commentsCollection = mongoDb.collection('comments_reviews');
        const reviews = await commentsCollection
            .find({ videoId })
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .toArray();
        const total = await commentsCollection.countDocuments({ videoId });
        res.status(200).json({
            status: 'success',
            data: reviews,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getRatedVideos = getRatedVideos;
/**
 * Add comment to video
 */
const addComment = async (req, res, next) => {
    try {
        const { videoId } = req.params;
        const { userId, content, rating } = req.body;
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const commentsCollection = mongoDb.collection('comments_reviews');
        const comment = {
            _id: (0, uuid_1.v4)(),
            videoId,
            userId,
            content,
            rating: rating || 0,
            status: 'pending',
            likes: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await commentsCollection.insertOne(comment);
        // Invalidate cache
        await redis_1.redisClient.del(`comments:${videoId}`);
        // Publish Kafka event
        await producer_1.kafkaProducer.send({
            topic: 'video.comment.added',
            messages: [
                {
                    key: videoId,
                    value: JSON.stringify({
                        videoId,
                        userId,
                        commentId: comment._id,
                        timestamp: new Date().toISOString()
                    })
                }
            ]
        });
        logger_1.logger.info(`Comment added to video: ${videoId} by ${userId}`);
        res.status(201).json({
            status: 'success',
            message: 'Comment added successfully',
            data: comment
        });
    }
    catch (error) {
        next(error);
    }
};
exports.addComment = addComment;
/**
 * Get comments for a video
 */
const getComments = async (req, res, next) => {
    try {
        const { videoId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        // Check cache
        const cachedComments = await redis_1.redisClient.get(`comments:${videoId}:${page}`);
        if (cachedComments) {
            res.status(200).json({
                status: 'success',
                data: JSON.parse(cachedComments),
                source: 'cache'
            });
            return;
        }
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const commentsCollection = mongoDb.collection('comments_reviews');
        const comments = await commentsCollection
            .find({ videoId, status: 'approved' })
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .toArray();
        const total = await commentsCollection.countDocuments({
            videoId,
            status: 'approved'
        });
        const response = {
            status: 'success',
            data: comments,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }
        };
        // Cache for 30 minutes
        await redis_1.redisClient.setEx(`comments:${videoId}:${page}`, 1800, JSON.stringify(response));
        res.status(200).json(response);
    }
    catch (error) {
        next(error);
    }
};
exports.getComments = getComments;
/**
 * Rate a video
 */
const rateVideo = async (req, res, next) => {
    try {
        const { videoId } = req.params;
        const { userId, rating, review } = req.body;
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const commentsCollection = mongoDb.collection('comments_reviews');
        const videosCollection = mongoDb.collection('videos');
        // Check if user already rated
        const existingRating = await commentsCollection.findOne({
            videoId,
            userId,
            rating: { $gt: 0 }
        });
        if (existingRating) {
            throw new errors_1.ValidationError('User already rated this video');
        }
        // Add rating
        const ratingRecord = {
            _id: (0, uuid_1.v4)(),
            videoId,
            userId,
            rating,
            review: review || '',
            status: 'approved',
            createdAt: new Date()
        };
        await commentsCollection.insertOne(ratingRecord);
        // Update video average rating
        const ratingStats = await commentsCollection
            .aggregate([
            { $match: { videoId, rating: { $gt: 0 } } },
            { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
        ])
            .toArray();
        if (ratingStats.length > 0) {
            await videosCollection.updateOne({ _id: videoId }, {
                $set: {
                    rating: ratingStats[0].avgRating,
                    reviewCount: ratingStats[0].count
                }
            });
        }
        // Invalidate cache
        await redis_1.redisClient.del(`video:${videoId}`);
        // Publish Kafka event
        await producer_1.kafkaProducer.send({
            topic: 'video.rated',
            messages: [
                {
                    key: videoId,
                    value: JSON.stringify({
                        videoId,
                        userId,
                        rating,
                        timestamp: new Date().toISOString()
                    })
                }
            ]
        });
        logger_1.logger.info(`Video rated: ${videoId} by ${userId} - ${rating}/5`);
        res.status(201).json({
            status: 'success',
            message: 'Rating recorded successfully',
            data: ratingRecord
        });
    }
    catch (error) {
        next(error);
    }
};
exports.rateVideo = rateVideo;
//# sourceMappingURL=content.controller.js.map
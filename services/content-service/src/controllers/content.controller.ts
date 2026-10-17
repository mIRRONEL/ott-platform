import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { mongoClient } from '../database/mongodb.connection';
import { elasticsearchClient } from '../database/elasticsearch.connection';
import { kafkaProducer } from '../kafka/producer';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { AppError, NotFoundError, ValidationError, DatabaseError } from '../utils/errors';
import { getVideoSegmentsDir } from '../utils/video-processor';

/**
 * Upload video file
 */
export const uploadVideo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('[CONTENT] Upload handler called');
    console.log('[CONTENT] File:', req.file ? { filename: req.file.filename, size: req.file.size } : 'NO FILE');
    console.log('[CONTENT] Body:', req.body);
    
    if (!req.file) {
      console.log('[CONTENT] Throwing: No video file provided');
      throw new ValidationError('No video file provided');
    }

    const { title, description, category, subCategory, thumbnail, posterImage } = req.body;
    
    console.log('[CONTENT] Validating title:', title);
    if (!title) {
      console.log('[CONTENT] Title validation failed, deleting file');
      // Delete uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      throw new ValidationError('Video title is required');
    }

    const userId = req.headers['x-user-id'] as string;
    const videoId = uuidv4();
    console.log('[CONTENT] Created videoId:', videoId, 'for user:', userId);
    
    const videoData = {
      id: videoId,
      user_id: userId,
      title,
      description: description || '',
      category: category || 'General',
      subCategory: subCategory || 'Other',
      fileName: req.file.filename,
      filePath: `/uploads/videos/${req.file.filename}`,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      duration: 0, // Will be updated by streaming service
      thumbnail: thumbnail || posterImage || `/api/stream/${videoId}/thumbnail`,
      posterImage: posterImage || thumbnail || `/api/stream/${videoId}/thumbnail`,
      status: 'processing',
      uploaded_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };

    console.log('[CONTENT] Saving to MongoDB...');
    // Save to MongoDB
    const db = mongoClient.db('ott_platform');
    const videosCollection = db.collection('videos');
    
    const insertResult = await videosCollection.insertOne(videoData);
    console.log('[CONTENT] MongoDB insert result:', insertResult);

    const autoDeleteRaw = req.body.deleteRawAfterEncode !== undefined
      ? (req.body.deleteRawAfterEncode === 'true' || req.body.deleteRawAfterEncode === true)
      : (process.env.AUTO_DELETE_RAW_AFTER_ENCODE !== 'false');

    console.log('[CONTENT] Publishing Kafka event...');
    // Publish event to Kafka
    if (kafkaProducer) {
      try {
        await kafkaProducer.send({
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
                deleteRawAfterEncode: autoDeleteRaw,
                timestamp: new Date().toISOString()
              })
            }
          ]
        });
        console.log('[CONTENT] Kafka event published successfully');
      } catch (kafkaError) {
        console.warn('[CONTENT] Failed to publish Kafka event:', kafkaError);
        logger.warn('Failed to publish video.uploaded event to Kafka', kafkaError);
      }
    } else {
      console.log('[CONTENT] Kafka producer not available, skipping event publish');
    }

    // NOTE: Encoding is now handled by encoding-service via Kafka event above
    // Content-service role: Accept upload, save metadata, publish event
    // Encoding-service role: Listen to video.uploaded, encode video, publish video.encoding.completed
    // When encoding completes, status will be updated by separate consumer listening to video.encoding.completed event
    
    console.log('[CONTENT] Video metadata saved. Encoding will be handled by encoding-service.');

    console.log('[CONTENT] Sending success response...');
    logger.info(`Video uploaded successfully: ${videoId}`);

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        videoId,
        fileName: req.file.filename,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        status: 'processing',
        uploaded_at: videoData.uploaded_at
      }
    });
    console.log('[CONTENT] Response sent successfully');
  } catch (error) {
    console.error('[CONTENT] Error in upload handler:', error);
    // Clean up uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        logger.warn('Failed to delete uploaded file', unlinkError);
      }
    }
    
    logger.error('Video upload error:', error);
    next(error);
  }
};

/**
 * Get all videos with pagination
 */
export const getAllVideos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    try {
      const db = mongoClient.db('ott_platform');
      const videosCollection = db.collection('videos');

      // Get total count
      const total = await videosCollection.countDocuments();

      // Get videos with pagination
      const videos = await videosCollection
        .find({})
        .sort({ created_at: -1 })
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
    } catch (dbError) {
      logger.error('Database error:', dbError);
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
  } catch (error) {
    logger.error('Get all videos error:', error);
    next(error);
  }
};

/**
 * Create a new video
 */
export const createVideo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const videoId = uuidv4();
    const {
      title,
      description,
      thumbnail,
      posterImage,
      duration,
      category,
      subCategory,
      releaseDate,
      director,
      cast,
      language,
      subtitle,
      contentRating,
      imdbRating,
      videoUrl,
      videoQuality,
      isActive = true,
      tags = []
    } = req.body;

    const mongoDb = mongoClient.db('ott_platform');
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
      user_id: req.headers['x-user-id'] as string || 'system',
      created_at: new Date(),
      updated_at: new Date()
    };

    // Insert into MongoDB
    await videosCollection.insertOne(videoData as any);

    // Index in Elasticsearch for search
    await elasticsearchClient.index({
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
    await kafkaProducer.send({
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

    logger.info(`Video created: ${videoId} - ${title}`);

    res.status(201).json({
      status: 'success',
      message: 'Video created successfully',
      data: videoData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get video by ID
 */
export const getVideoById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId } = req.params;

    // Check cache first
    const cachedVideo = await redisClient.get(`video:${videoId}`);
    if (cachedVideo) {
      logger.info(`Video retrieved from cache: ${videoId}`);
      res.status(200).json({
        status: 'success',
        data: JSON.parse(cachedVideo),
        source: 'cache'
      });
      return;
    }

    const mongoDb = mongoClient.db('ott_platform');
    const videosCollection = mongoDb.collection('videos');

    const video = await videosCollection.findOne({ id: videoId });

    if (!video) {
      throw new NotFoundError('Video not found');
    }

    // Increment views
    await videosCollection.updateOne(
      { id: videoId },
      { $inc: { views: 1 } }
    );

    // Cache for 30 minutes
    await redisClient.setEx(
      `video:${videoId}`,
      1800,
      JSON.stringify(video)
    );

    logger.info(`Video retrieved: ${videoId}`);

    res.status(200).json({
      status: 'success',
      data: video,
      source: 'database'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update video metadata
 */
export const updateVideo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId } = req.params;
    const updates = req.body;

    const mongoDb = mongoClient.db('ott_platform');
    const videosCollection = mongoDb.collection('videos');

    const result = await videosCollection.findOneAndUpdate(
      { _id: videoId } as any,
      {
        $set: {
          ...updates,
          updated_at: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      throw new NotFoundError('Video not found');
    }

    // Invalidate cache
    await redisClient.del(`video:${videoId}`);

    // Update Elasticsearch
    await elasticsearchClient.update({
      index: 'videos',
      id: videoId,
      doc: {
        ...updates,
        updated_at: new Date()
      }
    });

    // Publish Kafka event
    await kafkaProducer.send({
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

    logger.info(`Video updated: ${videoId}`);

    res.status(200).json({
      status: 'success',
      message: 'Video updated successfully',
      data: result.value
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete video
 */
export const deleteVideo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId } = req.params;

    const mongoDb = mongoClient.db('ott_platform');
    const videosCollection = mongoDb.collection('videos');

    const video = await videosCollection.findOne({ id: videoId } as any);
    if (!video) {
      throw new NotFoundError('Video not found');
    }

    const result = await videosCollection.deleteOne({ id: videoId } as any);
    if (result.deletedCount === 0) {
      throw new NotFoundError('Video not found');
    }

    // Delete uploaded file, raw video masters, and encoded HLS output
    try {
      const uploadsDir = process.env.UPLOAD_DIR || '/tmp/ott-uploads';
      const rawDir = process.env.RAW_VIDEOS_DIR || '/videos/raw';
      const encodedBaseDir = '/videos/encoded';
      const hlsOutputDir = process.env.HLS_OUTPUT_DIR || '/tmp/ott-hls';

      // 1. Delete encoded HLS directory (/videos/encoded/:videoId)
      const encodedVideoDir = path.join(encodedBaseDir, videoId);
      if (fs.existsSync(encodedVideoDir)) {
        fs.rmSync(encodedVideoDir, { recursive: true, force: true });
        logger.info(`Cleaned up encoded HLS directory: ${encodedVideoDir}`);
      }

      // 2. Delete raw video masters (/videos/raw/...)
      const rawCandidates = [
        video.fileName ? path.join(rawDir, video.fileName) : null,
        path.join(rawDir, `${videoId}.mp4`),
        video.filePath && fs.existsSync(video.filePath) ? video.filePath : null
      ].filter(Boolean);

      for (const rawPath of rawCandidates) {
        if (rawPath && fs.existsSync(rawPath)) {
          fs.unlinkSync(rawPath);
          logger.info(`Cleaned up raw video file: ${rawPath}`);
        }
      }

      // 3. Delete temporary upload session folder / files
      if (video.fileName) {
        const uploadPath = path.join(uploadsDir, video.fileName);
        if (fs.existsSync(uploadPath)) {
          fs.unlinkSync(uploadPath);
        }
      }
      const sessionDir = path.join(uploadsDir, videoId);
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }

      // 4. Delete temp HLS output if present
      const videoHlsDir = path.join(hlsOutputDir, videoId);
      if (fs.existsSync(videoHlsDir)) {
        fs.rmSync(videoHlsDir, { recursive: true, force: true });
      }
    } catch (fileError) {
      logger.warn('Failed to delete video files', fileError);
    }

    logger.info(`Video deleted: ${videoId}`);

    // Send response immediately
    res.status(200).json({
      status: 'success',
      message: 'Video deleted successfully'
    });

    // Delete from MongoDB watch history, watchlist, and dismissed lists
    try {
      await mongoDb.collection('user_watch_history').deleteMany({ videoId });
      await mongoDb.collection('user_dismissed_watch').deleteMany({ videoId });
      await mongoDb.collection('user_watchlist').deleteMany({ videoId });
    } catch (cleanupErr) {
      logger.warn('Failed to clean up watch history for deleted video', cleanupErr);
    }

    // Background cleanup tasks (fire-and-forget, don't block response)
    setImmediate(() => {
      // Invalidate cache
      redisClient.del(`video:${videoId}`)
        .catch(err => logger.warn('Failed to invalidate cache for deleted video', err));

      // Delete from Elasticsearch
      elasticsearchClient.delete({
        index: 'videos',
        id: videoId
      }).catch(err => logger.warn('Failed to delete video from Elasticsearch', err));

      // Publish Kafka event
      if (kafkaProducer) {
        kafkaProducer.send({
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
        }).catch(err => logger.warn('Failed to publish video.deleted event', err));
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search videos
 */
export const searchVideos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { q, category, page = 1, limit = 20, sortBy = 'relevance' } = req.query;
    const queryStr = String(q || '').trim();

    let results: any[] = [];
    let totalCount = 0;

    // 1. Try Elasticsearch first
    try {
      const searchQuery: any = {
        bool: {
          must: [
            {
              multi_match: {
                query: queryStr,
                fields: ['title^2', 'description', 'category', 'cast', 'director', 'tags']
              }
            }
          ]
        }
      };

      if (category && category !== 'All') {
        searchQuery.bool.filter = {
          term: { category: category }
        };
      }

      const sortMap: any = {
        relevance: [{ _score: { order: 'desc' } }],
        rating: [{ imdbRating: { order: 'desc' } }],
        newest: [{ releaseDate: { order: 'desc' } }],
        trending: [{ views: { order: 'desc' } }]
      };

      const response = await elasticsearchClient.search({
        index: 'videos',
        body: {
          query: searchQuery,
          sort: sortMap[sortBy as string] || sortMap.relevance,
          from: (Number(page) - 1) * Number(limit),
          size: Number(limit)
        }
      });

      if (response?.hits?.hits && response.hits.hits.length > 0) {
        results = response.hits.hits.map((hit: any) => ({
          ...hit._source,
          score: hit._score
        }));
        totalCount = typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value || results.length;
      }
    } catch (esError) {
      logger.warn('[SEARCH] Elasticsearch search failed or empty, falling back to MongoDB:', esError);
    }

    // 2. Fallback to MongoDB if Elasticsearch returned 0 or errored
    if (results.length === 0 && queryStr) {
      const mongoDb = mongoClient.db('ott_platform');
      const videosCollection = mongoDb.collection('videos');

      const regex = new RegExp(queryStr, 'i');
      const mongoQuery: any = {
        $or: [
          { title: { $regex: regex } },
          { description: { $regex: regex } },
          { category: { $regex: regex } }
        ]
      };

      if (category && category !== 'All') {
        mongoQuery.category = { $regex: new RegExp(`^${category}$`, 'i') };
      }

      totalCount = await videosCollection.countDocuments(mongoQuery);
      results = await videosCollection
        .find(mongoQuery)
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .toArray();
    }

    logger.info(`Videos searched: "${queryStr}", found ${results.length} results`);

    res.status(200).json({
      success: true,
      data: {
        videos: results,
        pagination: {
          totalCount,
          currentPage: Number(page),
          pageSize: Number(limit),
          totalPages: Math.ceil(totalCount / Number(limit)) || 1
        }
      }
    });
  } catch (error) {
    logger.error('Error in searchVideos:', error);
    next(error);
  }
};

/**
 * Get all categories
 */
export const getCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check cache
    const cachedCategories = await redisClient.get('categories');
    if (cachedCategories) {
      res.status(200).json({
        status: 'success',
        data: JSON.parse(cachedCategories),
        source: 'cache'
      });
      return;
    }

    const mongoDb = mongoClient.db('ott_platform');
    const videosCollection = mongoDb.collection('videos');

    const categories = await videosCollection
      .aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
      .toArray();

    // Cache for 1 hour
    await redisClient.setEx(
      'categories',
      3600,
      JSON.stringify(categories)
    );

    logger.info(`Categories retrieved: ${categories.length}`);

    res.status(200).json({
      status: 'success',
      data: categories,
      source: 'database'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get trending content
 */
export const getTrendingContent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check cache
    const cachedTrending = await redisClient.get('trending');
    if (cachedTrending) {
      res.status(200).json({
        status: 'success',
        data: JSON.parse(cachedTrending),
        source: 'cache'
      });
      return;
    }

    const mongoDb = mongoClient.db('ott_platform');
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
    await redisClient.setEx(
      'trending',
      21600,
      JSON.stringify(trendingVideos)
    );

    logger.info(`Trending content retrieved: ${trendingVideos.length}`);

    res.status(200).json({
      status: 'success',
      data: trendingVideos,
      source: 'database'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get video ratings and reviews
 */
export const getRatedVideos = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const mongoDb = mongoClient.db('ott_platform');
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
  } catch (error) {
    next(error);
  }
};

/**
 * Add comment to video
 */
export const addComment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId } = req.params;
    const { userId, content, rating } = req.body;

    const mongoDb = mongoClient.db('ott_platform');
    const commentsCollection = mongoDb.collection('comments_reviews');

    const comment = {
      _id: uuidv4(),
      videoId,
      userId,
      content,
      rating: rating || 0,
      status: 'pending',
      likes: 0,
      created_at: new Date(),
      updated_at: new Date()
    };

    await commentsCollection.insertOne(comment as any);

    // Invalidate cache
    await redisClient.del(`comments:${videoId}`);

    // Publish Kafka event
    await kafkaProducer.send({
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

    logger.info(`Comment added to video: ${videoId} by ${userId}`);

    res.status(201).json({
      status: 'success',
      message: 'Comment added successfully',
      data: comment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get comments for a video
 */
export const getComments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Check cache
    const cachedComments = await redisClient.get(`comments:${videoId}:${page}`);
    if (cachedComments) {
      res.status(200).json({
        status: 'success',
        data: JSON.parse(cachedComments),
        source: 'cache'
      });
      return;
    }

    const mongoDb = mongoClient.db('ott_platform');
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
    await redisClient.setEx(
      `comments:${videoId}:${page}`,
      1800,
      JSON.stringify(response)
    );

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Rate a video
 */
export const rateVideo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId } = req.params;
    const { userId, rating, review } = req.body;

    const mongoDb = mongoClient.db('ott_platform');
    const commentsCollection = mongoDb.collection('comments_reviews');
    const videosCollection = mongoDb.collection('videos');

    // Check if user already rated
    const existingRating = await commentsCollection.findOne({
      videoId,
      userId,
      rating: { $gt: 0 }
    });

    if (existingRating) {
      throw new ValidationError('User already rated this video');
    }

    // Add rating
    const ratingRecord = {
      _id: uuidv4(),
      videoId,
      userId,
      rating,
      review: review || '',
      status: 'approved',
      createdAt: new Date()
    };

    await commentsCollection.insertOne(ratingRecord as any);

    // Update video average rating
    const ratingStats = await commentsCollection
      .aggregate([
        { $match: { videoId, rating: { $gt: 0 } } },
        { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
      ])
      .toArray();

    if (ratingStats.length > 0) {
      await videosCollection.updateOne(
        { _id: videoId } as any,
        {
          $set: {
            rating: ratingStats[0].avgRating,
            reviewCount: ratingStats[0].count
          }
        }
      );
    }

    // Invalidate cache
    await redisClient.del(`video:${videoId}`);

    // Publish Kafka event
    await kafkaProducer.send({
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

    logger.info(`Video rated: ${videoId} by ${userId} - ${rating}/5`);

    res.status(201).json({
      status: 'success',
      message: 'Rating recorded successfully',
      data: ratingRecord
    });
  } catch (error) {
    next(error);
  }
};
/**
 * Get HLS manifest for video streaming
 */
export const getHLSManifest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId } = req.params;

    if (!videoId) {
      throw new ValidationError('Video ID is required');
    }

    const hlsDir = process.env.HLS_OUTPUT_DIR || path.join(process.env.UPLOAD_DIR || '/tmp/ott-uploads', '..', 'hls');
    const manifestPath = path.join(hlsDir, videoId, 'master.m3u8');

    // Check if HLS manifest exists
    if (fs.existsSync(manifestPath)) {
      let manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      
      // Rewrite relative paths to full API paths
      // Replace relative paths like "360p/playlist.m3u8" with full API paths "/api/content/hls/{videoId}/360p/playlist.m3u8"
      manifestContent = manifestContent.replace(/^(?!#|http|\/api)([^\n]+\.m3u8)$/gm, `/api/content/hls/${videoId}/$1`);
      
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(manifestContent);
      return;
    }

    // Fallback: Serve MP4 directly as a simple M3U8 playlist
    console.log('[CONTENT] HLS manifest not found, trying MP4 fallback for:', videoId);
    const db = mongoClient.db('ott_platform');
    const videosCollection = db.collection('videos');
    const video = await videosCollection.findOne({ id: videoId });

    if (!video || !video.fileName) {
      console.log('[CONTENT] Video not found in DB:', videoId);
      throw new NotFoundError(`Video not found: ${videoId}`);
    }

    console.log('[CONTENT] Using MP4 fallback for video:', videoId, 'file:', video.fileName);
    // Create a simple HLS playlist that references the MP4 file
    const mp4Url = `http://localhost:3003/uploads/${video.fileName}`;
    const simplePlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:0,
${mp4Url}
#EXT-X-ENDLIST`;

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(simplePlaylist);
  } catch (error) {
    console.error('[CONTENT] Error in getHLSManifest:', error);
    next(error);
  }
};

export const getProcessingProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId } = req.params;

    const db = mongoClient.db('ott_platform');
    const videosCollection = db.collection('videos');

    const video = await videosCollection.findOne({
      $or: [{ id: videoId }, { _id: videoId }]
    } as any);

    if (!video) {
      res.status(404).json({
        success: false,
        message: 'Video not found',
        statusCode: 404
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        videoId,
        status: video.status,
        hlsProgress: video.hlsProgress || 0,
        processingStage: video.processingStage || 'pending',
        title: video.title
      }
    });
  } catch (error) {
    console.error('[CONTENT] Error in getProcessingProgress:', error);
    next(error);
  }
};

/**
 * 1. Initialize Resumable Chunked Upload Session
 */
export const initChunkedUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { title, description, category, subCategory, fileName, fileSize, totalChunks, chunkSize } = req.body;

    if (!title || !fileSize || !totalChunks) {
      res.status(400).json({
        success: false,
        message: 'Missing required parameters: title, fileSize, and totalChunks are required.'
      });
      return;
    }

    const uploadId = uuidv4();
    const uploadBaseDir = process.env.UPLOAD_DIR || '/tmp/ott-uploads';
    const sessionDir = path.join(uploadBaseDir, uploadId);
    const chunksDir = path.join(sessionDir, 'chunks');

    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir, { recursive: true });
    }

    const sessionMetadata = {
      uploadId,
      title,
      description: description || '',
      category: category || 'General',
      subCategory: subCategory || 'Other',
      fileName: fileName || `${uploadId}.mp4`,
      fileSize: Number(fileSize),
      totalChunks: Number(totalChunks),
      chunkSize: Number(chunkSize) || 5 * 1024 * 1024,
      createdAt: new Date().toISOString()
    };

    fs.writeFileSync(path.join(sessionDir, 'metadata.json'), JSON.stringify(sessionMetadata, null, 2));

    logger.info(`Initialized resumable chunk upload session: ${uploadId} for file "${fileName}" (${totalChunks} chunks)`);

    res.status(201).json({
      success: true,
      message: 'Chunked upload session initialized',
      data: {
        uploadId,
        chunkSize: sessionMetadata.chunkSize,
        totalChunks: sessionMetadata.totalChunks,
        fileName: sessionMetadata.fileName
      }
    });
  } catch (error) {
    logger.error('Error initializing chunked upload:', error);
    next(error);
  }
};

/**
 * 2. Get Upload Status (Returns list of completed chunk indices for resumption)
 */
export const getChunkedUploadStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { uploadId } = req.params;
    const uploadBaseDir = process.env.UPLOAD_DIR || '/tmp/ott-uploads';
    const sessionDir = path.join(uploadBaseDir, uploadId);
    const chunksDir = path.join(sessionDir, 'chunks');
    const metadataPath = path.join(sessionDir, 'metadata.json');

    if (!fs.existsSync(sessionDir) || !fs.existsSync(metadataPath)) {
      res.status(404).json({
        success: false,
        message: 'Upload session not found or expired',
        data: { uploadId, uploadedChunks: [] }
      });
      return;
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    let uploadedChunks: number[] = [];

    if (fs.existsSync(chunksDir)) {
      const files = fs.readdirSync(chunksDir);
      uploadedChunks = files
        .filter((file) => file.startsWith('chunk_') && file.endsWith('.part'))
        .map((file) => {
          const match = file.match(/chunk_(\d+)\.part/);
          return match ? parseInt(match[1], 10) : -1;
        })
        .filter((index) => index >= 0)
        .sort((a, b) => a - b);
    }

    res.status(200).json({
      success: true,
      data: {
        uploadId,
        totalChunks: metadata.totalChunks,
        uploadedChunks,
        uploadedCount: uploadedChunks.length,
        isComplete: uploadedChunks.length === metadata.totalChunks
      }
    });
  } catch (error) {
    logger.error('Error getting chunked upload status:', error);
    next(error);
  }
};

/**
 * 3. Receive Single Chunk Part (Supports direct raw binary stream or multipart)
 */
export const uploadChunk = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const uploadId = (req.query.uploadId as string) || (req.headers['x-upload-id'] as string) || req.body?.uploadId;
    const chunkIndexRaw = req.query.chunkIndex !== undefined ? req.query.chunkIndex : (req.headers['x-chunk-index'] !== undefined ? req.headers['x-chunk-index'] : req.body?.chunkIndex);
    const chunkIndex = Number(chunkIndexRaw);

    if (!uploadId || isNaN(chunkIndex)) {
      res.status(400).json({
        success: false,
        message: 'uploadId and chunkIndex are required'
      });
      return;
    }

    // If file was already handled and written to disk by multer middleware
    if (req.file) {
      res.status(200).json({
        success: true,
        message: `Chunk ${chunkIndex} uploaded successfully`,
        data: {
          uploadId,
          chunkIndex
        }
      });
      return;
    }

    // Direct High-Performance Raw Binary Stream Handler (Zero multipart overhead)
    const uploadBaseDir = process.env.UPLOAD_DIR || '/tmp/ott-uploads';
    const chunksDir = path.join(uploadBaseDir, uploadId, 'chunks');
    const chunkPath = path.join(chunksDir, `chunk_${String(chunkIndex).padStart(5, '0')}.part`);

    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir, { recursive: true });
    }

    const writeStream = fs.createWriteStream(chunkPath, { highWaterMark: 1024 * 1024 });
    req.pipe(writeStream);

    writeStream.on('finish', () => {
      res.status(200).json({
        success: true,
        message: `Chunk ${chunkIndex} uploaded successfully`,
        data: {
          uploadId,
          chunkIndex
        }
      });
    });

    writeStream.on('error', (err) => {
      logger.error(`Error streaming raw chunk ${chunkIndex}:`, err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Failed to write chunk data' });
      }
    });
  } catch (error) {
    logger.error('Error handling chunk upload:', error);
    next(error);
  }
};

/**
 * 4. Complete Chunked Upload (Merges parts, creates video document, publishes to Kafka)
 */
export const completeChunkedUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { uploadId, title, description, category, subCategory, thumbnail, posterImage } = req.body;

    if (!uploadId) {
      res.status(400).json({
        success: false,
        message: 'uploadId is required to complete upload'
      });
      return;
    }

    const uploadBaseDir = process.env.UPLOAD_DIR || '/tmp/ott-uploads';
    const sessionDir = path.join(uploadBaseDir, uploadId);
    const chunksDir = path.join(sessionDir, 'chunks');
    const metadataPath = path.join(sessionDir, 'metadata.json');

    if (!fs.existsSync(sessionDir) || !fs.existsSync(metadataPath)) {
      res.status(404).json({
        success: false,
        message: 'Upload session not found or expired'
      });
      return;
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const totalChunks = metadata.totalChunks;

    // Verify all chunks exist
    const missingChunks: number[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunkFile = path.join(chunksDir, `chunk_${String(i).padStart(5, '0')}.part`);
      if (!fs.existsSync(chunkFile)) {
        missingChunks.push(i);
      }
    }

    if (missingChunks.length > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot complete upload. Missing ${missingChunks.length} chunks.`,
        data: { missingChunks }
      });
      return;
    }

    const videoId = uuidv4();
    const rawVideosDir = process.env.RAW_VIDEOS_DIR || '/videos/raw';
    if (!fs.existsSync(rawVideosDir)) {
      fs.mkdirSync(rawVideosDir, { recursive: true });
    }

    const targetMasterPath = path.join(rawVideosDir, `${videoId}.mp4`);

    // Save thumbnail to disk
    let thumbUrl = `/api/stream/${videoId}/thumbnail`;
    let posterUrl = `/api/stream/${videoId}/thumbnail`;

    const rawThumb = thumbnail || posterImage;
    if (rawThumb) {
      if (rawThumb.startsWith('data:image/')) {
        try {
          const thumbsDir = path.join(uploadBaseDir, 'thumbnails');
          if (!fs.existsSync(thumbsDir)) {
            fs.mkdirSync(thumbsDir, { recursive: true });
          }
          const base64Data = rawThumb.replace(/^data:image\/\w+;base64,/, '');
          const thumbFileName = `${videoId}.jpg`;
          const thumbFilePath = path.join(thumbsDir, thumbFileName);
          fs.writeFileSync(thumbFilePath, Buffer.from(base64Data, 'base64'));
          thumbUrl = `/api/content/uploads/thumbnails/${thumbFileName}`;
          posterUrl = `/api/content/uploads/thumbnails/${thumbFileName}`;
        } catch (imgErr) {
          logger.warn('Failed to write thumbnail to disk:', imgErr);
        }
      } else {
        thumbUrl = rawThumb;
        posterUrl = rawThumb;
      }
    }

    const userId = (req.headers['x-user-id'] as string) || req.body.userId || metadata.userId || 'admin';
    const estimatedSize = metadata.fileSize || 0;
    const autoTranscode = req.body.autoTranscode !== false; // defaults to true unless explicitly false

    const initialStatus = autoTranscode ? 'processing' : 'staged';
    const initialStage = autoTranscode ? 'assembling' : 'staged_raw';

    const videoData = {
      id: videoId,
      user_id: userId,
      title: title || metadata.title || 'Untitled Video',
      description: description || metadata.description || '',
      category: category || metadata.category || 'General',
      subCategory: subCategory || metadata.subCategory || 'Other',
      fileName: `${videoId}.mp4`,
      filePath: targetMasterPath,
      mimeType: 'video/mp4',
      fileSize: estimatedSize,
      duration: 0,
      thumbnail: thumbUrl,
      posterImage: posterUrl,
      status: initialStatus,
      hlsProgress: autoTranscode ? 5 : 0,
      processingStage: initialStage,
      hasRawMaster: true,
      rawFileSize: estimatedSize,
      uploaded_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };

    const db = mongoClient.db('ott_platform');
    const videosCollection = db.collection('videos');
    await videosCollection.insertOne(videoData);

    // Respond immediately to client to prevent any 504 Gateway Timeouts
    res.status(201).json({
      success: true,
      message: autoTranscode
        ? 'Video upload completed and queued for processing'
        : 'Video upload completed and staged as raw master. Ready for on-demand transcoding.',
      data: {
        videoId,
        fileName: `${videoId}.mp4`,
        fileSize: estimatedSize,
        status: initialStatus,
        autoTranscode,
        uploaded_at: videoData.uploaded_at
      }
    });

    // Asynchronously stream-merge chunks and conditionally publish to Kafka
    setImmediate(async () => {
      try {
        // Stream-merge chunks sequentially with backpressure to prevent memory exhaustion (OOM)
        const writeStream = fs.createWriteStream(targetMasterPath);
        let totalMergedSize = 0;

        for (let i = 0; i < totalChunks; i++) {
          const chunkFile = path.join(chunksDir, `chunk_${String(i).padStart(5, '0')}.part`);
          if (!fs.existsSync(chunkFile)) {
            throw new Error(`Missing chunk ${i} at path ${chunkFile}`);
          }
          const readStream = fs.createReadStream(chunkFile);
          for await (const chunk of readStream) {
            totalMergedSize += chunk.length;
            if (!writeStream.write(chunk)) {
              await new Promise<void>((resolve) => writeStream.once('drain', resolve));
            }
          }
        }

        await new Promise<void>((resolve, reject) => {
          writeStream.end(() => resolve());
          writeStream.on('error', (err) => reject(err));
        });

        logger.info(`✓ Successfully assembled master video (${(totalMergedSize / (1024 * 1024)).toFixed(2)} MB) for ${videoId}`);

        // Clean up temporary chunks
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (cleanErr) {
          logger.warn(`Could not clean up temporary upload directory ${sessionDir}:`, cleanErr);
        }

        if (autoTranscode) {
          // Update database with final merged size and transition stage to encoding
          await videosCollection.updateOne(
            { id: videoId },
            {
              $set: {
                fileSize: totalMergedSize,
                rawFileSize: totalMergedSize,
                hasRawMaster: true,
                processingStage: 'encoding',
                updated_at: new Date()
              }
            }
          );

          const autoDeleteRaw = req.body.deleteRawAfterEncode !== undefined
            ? Boolean(req.body.deleteRawAfterEncode)
            : (process.env.AUTO_DELETE_RAW_AFTER_ENCODE !== 'false');

          // Publish video.uploaded event to Kafka
          if (kafkaProducer) {
            await kafkaProducer.send({
              topic: 'video.uploaded',
              messages: [
                {
                  key: videoId,
                  value: JSON.stringify({
                    videoId,
                    fileName: `${videoId}.mp4`,
                    filePath: targetMasterPath,
                    originalFilePath: targetMasterPath,
                    mimeType: 'video/mp4',
                    fileSize: totalMergedSize,
                    title: videoData.title,
                    deleteRawAfterEncode: autoDeleteRaw,
                    timestamp: new Date().toISOString()
                  })
                }
              ]
            });
            logger.info(`✓ Published video.uploaded Kafka event for ${videoId} (deleteRawAfterEncode: ${autoDeleteRaw})`);
          }
        } else {
          // Staged mode: Keep in staged status, do not dispatch to Kafka yet
          await videosCollection.updateOne(
            { id: videoId },
            {
              $set: {
                fileSize: totalMergedSize,
                rawFileSize: totalMergedSize,
                hasRawMaster: true,
                status: 'staged',
                processingStage: 'staged_raw',
                updated_at: new Date()
              }
            }
          );
          logger.info(`✓ Video ${videoId} is STAGED as raw master. Awaiting manual trigger.`);
        }
      } catch (mergeError) {
        logger.error(`Error during async chunk assembly for ${videoId}:`, mergeError);
        await videosCollection.updateOne(
          { id: videoId },
          {
            $set: {
              status: 'error',
              processingStage: 'failed',
              errorMessage: 'Chunk assembly failed',
              updated_at: new Date()
            }
          }
        );
      }
    });
  } catch (error) {
    logger.error('Error completing chunked upload:', error);
    next(error);
  }
};

/**
 * On-demand trigger for video transcoding
 */
export const triggerVideoTranscoding = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId } = req.params;
    const { profiles = ['1080p', '720p', '480p', '360p'], preset = 'superfast', deleteRawAfterEncode = false } = req.body;

    const db = mongoClient.db('ott_platform');
    const videosCollection = db.collection('videos');

    const video = await videosCollection.findOne({ $or: [{ id: videoId }, { _id: videoId }] } as any);
    if (!video) {
      res.status(404).json({ success: false, message: 'Video not found' });
      return;
    }

    const rawVideosDir = process.env.RAW_VIDEOS_DIR || '/videos/raw';
    const rawFilePath = path.join(rawVideosDir, `${video.id || videoId}.mp4`);

    if (!fs.existsSync(rawFilePath)) {
      res.status(400).json({
        success: false,
        message: 'Raw master video file not found on disk. Video cannot be transcoded.'
      });
      return;
    }

    const rawStats = fs.statSync(rawFilePath);

    // Update status to processing / queued
    await videosCollection.updateOne(
      { $or: [{ id: videoId }, { _id: videoId }] } as any,
      {
        $set: {
          status: 'processing',
          processingStage: 'queued',
          hlsProgress: 5,
          requestedProfiles: profiles,
          encodingPreset: preset,
          deleteRawAfterEncode: !!deleteRawAfterEncode,
          updated_at: new Date()
        }
      }
    );

    // Publish video.uploaded event to Kafka with custom options
    if (kafkaProducer) {
      await kafkaProducer.send({
        topic: 'video.uploaded',
        messages: [
          {
            key: video.id || videoId,
            value: JSON.stringify({
              videoId: video.id || videoId,
              fileName: `${video.id || videoId}.mp4`,
              filePath: rawFilePath,
              originalFilePath: rawFilePath,
              mimeType: 'video/mp4',
              fileSize: rawStats.size,
              title: video.title,
              profiles,
              preset,
              deleteRawAfterEncode: !!deleteRawAfterEncode,
              timestamp: new Date().toISOString()
            })
          }
        ]
      });
      logger.info(`✓ Triggered on-demand transcoding for video: ${videoId}`);
    }

    res.status(200).json({
      success: true,
      message: 'Transcoding job initiated successfully',
      data: {
        videoId: video.id || videoId,
        status: 'processing',
        processingStage: 'queued',
        profiles,
        preset
      }
    });
  } catch (error) {
    logger.error('Error triggering video transcoding:', error);
    next(error);
  }
};

/**
 * Delete only the raw master MP4 file to reclaim disk space, keeping HLS streaming intact
 */
export const deleteRawMasterVideo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId } = req.params;

    const db = mongoClient.db('ott_platform');
    const videosCollection = db.collection('videos');

    const video = await videosCollection.findOne({ $or: [{ id: videoId }, { _id: videoId }] } as any);
    if (!video) {
      res.status(404).json({ success: false, message: 'Video not found' });
      return;
    }

    const rawVideosDir = process.env.RAW_VIDEOS_DIR || '/videos/raw';
    const rawFilePath = path.join(rawVideosDir, `${video.id || videoId}.mp4`);

    let reclaimedBytes = 0;
    if (fs.existsSync(rawFilePath)) {
      const stats = fs.statSync(rawFilePath);
      reclaimedBytes = stats.size;
      fs.unlinkSync(rawFilePath);
      logger.info(`✓ Purged raw master file for video ${videoId} (reclaimed ${(reclaimedBytes / 1024 / 1024).toFixed(2)} MB)`);
    }

    await videosCollection.updateOne(
      { $or: [{ id: videoId }, { _id: videoId }] } as any,
      {
        $set: {
          hasRawMaster: false,
          rawFileSize: 0,
          rawMasterDeletedAt: new Date(),
          updated_at: new Date()
        }
      }
    );

    res.status(200).json({
      success: true,
      message: `Raw master file deleted successfully. Reclaimed ${(reclaimedBytes / 1024 / 1024).toFixed(2)} MB. Stream remains fully active.`,
      data: {
        videoId: video.id || videoId,
        reclaimedBytes,
        reclaimedMB: (reclaimedBytes / 1024 / 1024).toFixed(2),
        hasRawMaster: false
      }
    });
  } catch (error) {
    logger.error('Error deleting raw master video:', error);
    next(error);
  }
};

/**
 * Studio Media Manager Summary (Detailed Disk & Video Lifecycle Stats)
 */
export const getStudioSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const db = mongoClient.db('ott_platform');
    const videosCollection = db.collection('videos');

    const videos = await videosCollection.find({}).sort({ created_at: -1 }).toArray();

    const rawVideosDir = process.env.RAW_VIDEOS_DIR || '/videos/raw';
    const encodedVideosDir = process.env.ENCODED_VIDEOS_DIR || '/videos/encoded';

    // Helper to calculate folder size on disk
    const getDirSize = (dir: string): number => {
      let size = 0;
      try {
        if (!fs.existsSync(dir)) return 0;
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
          const filePath = path.join(dir, file.name);
          if (file.isDirectory()) {
            size += getDirSize(filePath);
          } else {
            size += fs.statSync(filePath).size;
          }
        }
      } catch (_) {}
      return size;
    };

    let totalRawBytes = 0;
    let totalEncodedBytes = 0;

    const enrichedVideos = videos.map((v: any) => {
      const vId = v.id || String(v._id);
      const rawFile = path.join(rawVideosDir, `${vId}.mp4`);
      const encodedDir = path.join(encodedVideosDir, vId);

      let rawSize = 0;
      let hasRaw = false;
      if (fs.existsSync(rawFile)) {
        try {
          rawSize = fs.statSync(rawFile).size;
          hasRaw = true;
          totalRawBytes += rawSize;
        } catch (_) {}
      }

      let encodedSize = 0;
      let availableQualities: string[] = [];
      if (fs.existsSync(encodedDir)) {
        try {
          encodedSize = getDirSize(encodedDir);
          totalEncodedBytes += encodedSize;
          const entries = fs.readdirSync(encodedDir, { withFileTypes: true });
          availableQualities = entries.filter(e => e.isDirectory()).map(e => e.name);
        } catch (_) {}
      }

      return {
        id: vId,
        title: v.title,
        description: v.description,
        category: v.category,
        thumbnail: v.thumbnail || v.posterImage,
        status: v.status || 'ready',
        processingStage: v.processingStage || (v.status === 'ready' ? 'completed' : 'staged_raw'),
        hlsProgress: v.hlsProgress || (v.status === 'ready' ? 100 : 0),
        fileSize: v.fileSize || 0,
        hasRawMaster: hasRaw,
        rawSize,
        encodedSize,
        availableQualities: availableQualities.length > 0 ? availableQualities : (v.encodingProfiles || ['720p', '480p', '360p']),
        createdAt: v.created_at || v.uploaded_at || new Date()
      };
    });

    const counts = {
      total: enrichedVideos.length,
      staged: enrichedVideos.filter((v: any) => v.status === 'staged' || v.processingStage === 'staged_raw').length,
      processing: enrichedVideos.filter((v: any) => v.status === 'processing').length,
      ready: enrichedVideos.filter((v: any) => v.status === 'ready').length,
      failed: enrichedVideos.filter((v: any) => v.status === 'error' || v.status === 'failed').length
    };

    res.status(200).json({
      success: true,
      data: {
        counts,
        storage: {
          totalRawBytes,
          totalRawGB: (totalRawBytes / (1024 * 1024 * 1024)).toFixed(2),
          totalEncodedBytes,
          totalEncodedGB: (totalEncodedBytes / (1024 * 1024 * 1024)).toFixed(2),
          totalCombinedGB: ((totalRawBytes + totalEncodedBytes) / (1024 * 1024 * 1024)).toFixed(2)
        },
        videos: enrichedVideos
      }
    });
  } catch (error) {
    logger.error('Error fetching studio summary:', error);
    next(error);
  }
};
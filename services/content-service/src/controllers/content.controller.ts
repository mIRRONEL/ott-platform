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
import { getVideoSegmentsDir, processVideoToHLS } from '../utils/video-processor';

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

    const { title, description, category, subCategory } = req.body;
    
    console.log('[CONTENT] Validating title:', title);
    if (!title) {
      console.log('[CONTENT] Title validation failed, deleting file');
      // Delete uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      throw new ValidationError('Video title is required');
    }

    const videoId = uuidv4();
    console.log('[CONTENT] Created videoId:', videoId);
    
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

    console.log('[CONTENT] Saving to MongoDB...');
    // Save to MongoDB
    const db = mongoClient.db('ott_platform');
    const videosCollection = db.collection('videos');
    
    const insertResult = await videosCollection.insertOne(videoData);
    console.log('[CONTENT] MongoDB insert result:', insertResult);

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

    // Trigger HLS processing asynchronously (don't wait for it)
    console.log('[CONTENT] Starting async HLS processing for video:', videoId);
    const uploadsDir = process.env.UPLOAD_DIR || '/tmp/ott-uploads';
    const inputPath = path.join(uploadsDir, req.file.filename);
    const hlsOutputDir = process.env.HLS_OUTPUT_DIR || '/tmp/ott-hls';
    
    // Process video in background
    processVideoToHLS(videoId, inputPath, hlsOutputDir)
      .then(async () => {
        console.log('[CONTENT] HLS processing completed for video:', videoId);
        // Update video status to ready
        try {
          const db = mongoClient.db('ott_platform');
          const videosCollection = db.collection('videos');
          await videosCollection.updateOne(
            { id: videoId },
            {
              $set: {
                status: 'ready',
                updatedAt: new Date()
              }
            }
          );
          console.log('[CONTENT] Updated video status to ready:', videoId);
        } catch (dbError) {
          logger.error('Failed to update video status after HLS processing', dbError);
        }
      })
      .catch((error) => {
        console.error('[CONTENT] HLS processing failed for video:', videoId, error);
        logger.error(`HLS processing failed for video ${videoId}:`, error);
        // Update video status to error
        try {
          const db = mongoClient.db('ott_platform');
          const videosCollection = db.collection('videos');
          videosCollection.updateOne(
            { id: videoId },
            {
              $set: {
                status: 'error',
                errorMessage: error.message,
                updatedAt: new Date()
              }
            }
          ).catch(e => logger.error('Failed to update error status', e));
        } catch (dbError) {
          logger.error('Failed to update video error status', dbError);
        }
      });

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
        uploadedAt: videoData.uploadedAt
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
      createdAt: new Date(),
      updatedAt: new Date()
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

    const video = await videosCollection.findOne({ _id: videoId } as any);

    if (!video) {
      throw new NotFoundError('Video not found');
    }

    // Increment views
    await videosCollection.updateOne(
      { _id: videoId } as any,
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
          updatedAt: new Date()
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
        updatedAt: new Date()
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

    // Delete uploaded file and HLS output
    try {
      const uploadsDir = process.env.UPLOAD_DIR || '/tmp/ott-uploads';
      if (video.fileName) {
        const uploadPath = path.join(uploadsDir, video.fileName);
        if (fs.existsSync(uploadPath)) {
          fs.unlinkSync(uploadPath);
        }
      }

      const hlsOutputDir = process.env.HLS_OUTPUT_DIR || '/tmp/ott-hls';
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

    // Elasticsearch search
    const searchQuery: any = {
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

    const results = response.hits.hits.map((hit: any) => ({
      ...hit._source,
      score: hit._score
    }));

    logger.info(`Videos searched: ${q}, found ${(typeof response.hits.total === "number" ? response.hits.total : response.hits.total.value)}`);

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
  } catch (error) {
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
      createdAt: new Date(),
      updatedAt: new Date()
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

    const video = await videosCollection.findOne({ id: videoId });

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
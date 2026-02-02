import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { mongoClient } from '../database/mongodb.connection';
import { kafkaProducer } from '../kafka/producer';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError, AppError } from '../utils/errors';

interface StreamSession {
  sessionId: string;
  userId: string;
  videoId: string;
  deviceId: string;
  startTime: Date;
  endTime?: Date;
  currentPosition: number;
  duration: number;
  quality: string;
  bandwidth: number;
  isActive: boolean;
  buffering: number;
  paused: boolean;
}

/**
 * Start streaming session
 */
export const startStream = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId, videoId, deviceId, quality, userAgent } = req.body;
    const sessionId = uuidv4();

    const mongoDb = mongoClient.db('ott_platform');
    const streamingCollection = mongoDb.collection('streaming_sessions');

    const session: StreamSession = {
      sessionId,
      userId,
      videoId,
      deviceId,
      startTime: new Date(),
      currentPosition: 0,
      duration: 0,
      quality,
      bandwidth: 0,
      isActive: true,
      buffering: 0,
      paused: false
    };

    await streamingCollection.insertOne(session);

    // Cache session for quick access (expires in 24 hours)
    await redisClient.setEx(
      `stream:${sessionId}`,
      86400,
      JSON.stringify(session)
    );

    // Publish Kafka event
    await kafkaProducer.send({
      topic: 'user.stream.started',
      messages: [
        {
          key: userId,
          value: JSON.stringify({
            userId,
            videoId,
            sessionId,
            quality,
            deviceId,
            timestamp: new Date().toISOString(),
            eventId: `${sessionId}-${Date.now()}`
          })
        }
      ]
    });

    logger.info(`Stream session started: ${sessionId} - User: ${userId} - Video: ${videoId}`);

    res.status(201).json({
      status: 'success',
      message: 'Streaming session started',
      data: {
        sessionId,
        userId,
        videoId,
        quality,
        startTime: session.startTime
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get HLS/DASH manifest
 */
export const getStreamManifest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId } = req.params;
    const { format = 'hls' } = req.query;

    // Check cache first
    const cachedManifest = await redisClient.get(`manifest:${videoId}:${format}`);
    if (cachedManifest) {
      logger.info(`Manifest retrieved from cache: ${videoId}`);
      res.setHeader('Content-Type', format === 'hls' ? 'application/vnd.apple.mpegurl' : 'application/dash+xml');
      res.send(cachedManifest);
      return;
    }

    const mongoDb = mongoClient.db('ott_platform');
    const videosCollection = mongoDb.collection('videos');

    const video = await videosCollection.findOne({ _id: videoId } as any);
    if (!video) {
      throw new NotFoundError('Video not found');
    }

    let manifest: string;

    if (format === 'hls') {
      // Generate HLS manifest (m3u8)
      manifest = generateHLSManifest(videoId, video);
    } else if (format === 'dash') {
      // Generate DASH manifest (mpd)
      manifest = generateDASHManifest(videoId, video);
    } else {
      throw new ValidationError('Invalid format. Use hls or dash');
    }

    // Cache manifest for 1 hour
    await redisClient.setEx(
      `manifest:${videoId}:${format}`,
      3600,
      manifest
    );

    res.setHeader(
      'Content-Type',
      format === 'hls' ? 'application/vnd.apple.mpegurl' : 'application/dash+xml'
    );
    res.send(manifest);
  } catch (error) {
    next(error);
  }
};

/**
 * Get video segment
 */
export const getVideoSegment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId, segmentId } = req.params;
    const { quality = '720p' } = req.query;

    const mongoDb = mongoClient.db('ott_platform');
    const videosCollection = mongoDb.collection('videos');

    const video = await videosCollection.findOne({ _id: videoId } as any);
    if (!video) {
      throw new NotFoundError('Video not found');
    }

    // In real implementation, fetch from S3 or CDN
    // For now, return mock segment URL
    const segmentUrl = `${process.env.CDN_URL || 'https://cdn.example.com'}/videos/${videoId}/${quality}/${segmentId}.ts`;

    // Track segment access
    await mongoDb.collection('segment_logs').insertOne({
      videoId,
      segmentId,
      quality,
      timestamp: new Date()
    });

    res.setHeader('Content-Type', 'video/MP2T');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Redirect to actual segment location
    res.status(302).redirect(segmentUrl);
  } catch (error) {
    next(error);
  }
};

/**
 * Get playback status
 */
export const getPlaybackStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sessionId } = req.params;

    // Check cache first
    const cachedSession = await redisClient.get(`stream:${sessionId}`);
    if (cachedSession) {
      logger.info(`Playback status from cache: ${sessionId}`);
      res.status(200).json({
        status: 'success',
        data: JSON.parse(cachedSession),
        source: 'cache'
      });
      return;
    }

    const mongoDb = mongoClient.db('ott_platform');
    const streamingCollection = mongoDb.collection('streaming_sessions');

    const session = await streamingCollection.findOne({ sessionId });
    if (!session) {
      throw new NotFoundError('Stream session not found');
    }

    res.status(200).json({
      status: 'success',
      data: session,
      source: 'database'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update playback position
 */
export const updatePlaybackPosition = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { position, duration, quality, paused, bandwidth } = req.body;

    const mongoDb = mongoClient.db('ott_platform');
    const streamingCollection = mongoDb.collection('streaming_sessions');

    const updates: any = {
      currentPosition: position,
      duration,
      paused: paused || false
    };

    if (quality) updates.quality = quality;
    if (bandwidth) updates.bandwidth = bandwidth;

    const result = await streamingCollection.findOneAndUpdate(
      { sessionId },
      { $set: updates },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      throw new NotFoundError('Stream session not found');
    }

    // Update cache
    await redisClient.setEx(
      `stream:${sessionId}`,
      86400,
      JSON.stringify(result.value)
    );

    // Log playback event
    await mongoDb.collection('user_activity').insertOne({
      userId: result.value.userId,
      videoId: result.value.videoId,
      type: 'pause' in req.body && req.body.paused ? 'paused' : 'playing',
      position,
      quality,
      timestamp: new Date()
    });

    logger.info(`Playback updated: ${sessionId} - Position: ${position}s`);

    res.status(200).json({
      status: 'success',
      message: 'Playback position updated',
      data: result.value
    });
  } catch (error) {
    next(error);
  }
};

/**
 * End streaming session
 */
export const endStream = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const mongoDb = mongoClient.db('ott_platform');
    const streamingCollection = mongoDb.collection('streaming_sessions');

    const session = await streamingCollection.findOne({ sessionId });
    if (!session) {
      throw new NotFoundError('Stream session not found');
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - new Date(session.startTime).getTime()) / 1000;

    // Update session
    const result = await streamingCollection.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          isActive: false,
          endTime
        }
      },
      { returnDocument: 'after' }
    );

    // Remove from cache
    await redisClient.del(`stream:${sessionId}`);

    // Record view history
    await mongoDb.collection('view_history').updateOne(
      { userId: session.userId, videoId: session.videoId },
      {
        $set: {
          lastWatchedPosition: session.currentPosition,
          lastWatchedAt: endTime,
          totalWatchTime: session.currentPosition
        }
      },
      { upsert: true }
    );

    // Publish Kafka event
    await kafkaProducer.send({
      topic: 'user.stream.ended',
      messages: [
        {
          key: session.userId,
          value: JSON.stringify({
            userId: session.userId,
            videoId: session.videoId,
            sessionId,
            duration,
            position: session.currentPosition,
            quality: session.quality,
            bandwidth: session.bandwidth,
            timestamp: endTime.toISOString(),
            eventId: `${sessionId}-${Date.now()}`
          })
        }
      ]
    });

    logger.info(`Stream session ended: ${sessionId} - Duration: ${duration}s`);

    res.status(200).json({
      status: 'success',
      message: 'Stream session ended',
      data: {
        sessionId,
        duration,
        watchedUntil: session.currentPosition
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get available quality options
 */
export const getStreamQuality = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId } = req.params;
    const { deviceType = 'desktop', bandwidth } = req.query;

    const mongoDb = mongoClient.db('ott_platform');
    const videosCollection = mongoDb.collection('videos');

    const video = await videosCollection.findOne(
      { _id: videoId } as any,
      { projection: { videoQuality: 1 } }
    );

    if (!video) {
      throw new NotFoundError('Video not found');
    }

    const availableQualities = video.videoQuality || ['720p', '1080p'];

    // Filter qualities based on device type and bandwidth
    const qualityMap: any = {
      mobile: ['360p', '480p'],
      tablet: ['480p', '720p'],
      desktop: ['720p', '1080p'],
      tv: ['1080p', '4k']
    };

    let recommendedQualities = qualityMap[deviceType as string] || availableQualities;

    // Filter by bandwidth if provided
    if (bandwidth) {
      const bw = Number(bandwidth);
      if (bw < 2) {
        recommendedQualities = recommendedQualities.filter((q: string) =>
          ['360p', '480p'].includes(q)
        );
      } else if (bw < 5) {
        recommendedQualities = recommendedQualities.filter((q: string) =>
          ['480p', '720p'].includes(q)
        );
      }
    }

    const qualities = availableQualities.filter((q: string) =>
      recommendedQualities.includes(q)
    );

    logger.info(`Quality options retrieved for ${videoId}: ${qualities.join(', ')}`);

    res.status(200).json({
      status: 'success',
      data: {
        videoId,
        availableQualities: qualities,
        recommended: qualities[qualities.length - 1]
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Report streaming error
 */
export const reportStreamError = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId, videoId, deviceId } = req.body;
    const { errorMessage, errorCode, timestamp } = req.body;

    const mongoDb = mongoClient.db('ott_platform');
    const errorLogsCollection = mongoDb.collection('streaming_errors');

    const errorLog = {
      _id: uuidv4(),
      userId,
      videoId,
      deviceId,
      errorMessage,
      errorCode,
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
      timestamp: new Date(timestamp) || new Date(),
      resolved: false
    };

    await errorLogsCollection.insertOne(errorLog as any);

    // Publish Kafka event for monitoring
    await kafkaProducer.send({
      topic: 'system.error',
      messages: [
        {
          key: videoId,
          value: JSON.stringify({
            errorId: errorLog._id,
            userId,
            videoId,
            errorCode,
            timestamp: errorLog.timestamp.toISOString(),
            severity: 'warning'
          })
        }
      ]
    });

    logger.warn(`Streaming error reported: ${errorCode} - Video: ${videoId} - User: ${userId}`);

    res.status(201).json({
      status: 'success',
      message: 'Error logged successfully',
      data: {
        errorId: errorLog._id
      }
    });
  } catch (error) {
    next(error);
  }
};

// Helper functions

function generateHLSManifest(videoId: string, video: any): string {
  const baseUrl = `${process.env.API_URL || 'http://localhost:3004'}/api/stream/${videoId}`;
  const qualities = video.videoQuality || ['720p', '1080p'];

  let manifest = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n\n';

  qualities.forEach((quality: string) => {
    const bandwidth = getBandwidthForQuality(quality);
    manifest += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${getResolutionForQuality(quality)}\n`;
    manifest += `${baseUrl}/playlist/${quality}.m3u8\n\n`;
  });

  return manifest;
}

function generateDASHManifest(videoId: string, video: any): string {
  const baseUrl = `${process.env.API_URL || 'http://localhost:3004'}/api/stream/${videoId}`;
  const qualities = video.videoQuality || ['720p', '1080p'];

  let manifest = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" mediaPresentationDuration="PT${video.duration}S">
  <Period>`;

  qualities.forEach((quality: string) => {
    const bandwidth = getBandwidthForQuality(quality);
    const resolution = getResolutionForQuality(quality);

    manifest += `
    <AdaptationSet mimeType="video/mp4" segmentAlignment="true" startWithSAP="1">
      <Representation id="${quality}" bandwidth="${bandwidth}" width="${resolution.split('x')[0]}" height="${resolution.split('x')[1]}">
        <BaseURL>${baseUrl}/video/${quality}.mp4</BaseURL>
      </Representation>
    </AdaptationSet>`;
  });

  manifest += `
  </Period>
</MPD>`;

  return manifest;
}

function getBandwidthForQuality(quality: string): number {
  const bandwidthMap: any = {
    '360p': 800000,
    '480p': 2500000,
    '720p': 5000000,
    '1080p': 8000000,
    '4k': 15000000
  };
  return bandwidthMap[quality] || 5000000;
}

function getResolutionForQuality(quality: string): string {
  const resolutionMap: any = {
    '360p': '640x360',
    '480p': '854x480',
    '720p': '1280x720',
    '1080p': '1920x1080',
    '4k': '3840x2160'
  };
  return resolutionMap[quality] || '1280x720';
}

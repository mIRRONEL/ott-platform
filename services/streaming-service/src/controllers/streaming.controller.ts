import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import { join } from 'path';
import { mongoClient } from '../database/mongodb.connection';
import { kafkaProducer } from '../kafka/producer';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError, AppError } from '../utils/errors';
import {
  generateStreamToken,
  verifyStreamToken,
  getVideoDrmKey,
  getVideoQualityIV,
  encryptSegmentAES128
} from '../utils/drm';
import concurrencyGuard from '../utils/concurrency';

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
 * Generate HMAC-SHA256 Signed Playback Token & DRM metadata
 * Route: POST /api/stream/token, GET /api/stream/:videoId/token
 */
export const generatePlaybackToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const videoId = req.params.videoId || req.body?.videoId || req.query?.videoId;
    const userId = String((req as any).user?.userId || req.headers['x-user-id'] || req.body?.userId || req.query?.userId || 'anonymous');

    if (!videoId) {
      res.status(400).json({ status: 'error', message: 'videoId is required' });
      return;
    }

    const userRole = (req as any).user?.role || (req.headers['x-user-role'] as string);
    const tier = (req as any).user?.subscriptionTier || (req.headers['x-subscription-tier'] as string);

    // Enforce concurrent screen limit for logged-in users
    if (userId && userId !== 'anonymous') {
      const activeStreams = await concurrencyGuard.getActiveStreams(userId);
      const maxScreens = concurrencyGuard.getMaxScreens(userRole, tier);

      if (activeStreams.length >= maxScreens) {
        logger.warn(`[Concurrency] User ${userId} reached max screen limit (${activeStreams.length}/${maxScreens})`);
        res.status(429).json({
          status: 'error',
          code: 'CONCURRENT_STREAM_LIMIT_EXCEEDED',
          message: `Concurrent screen limit reached. Your plan allows up to ${maxScreens} simultaneous stream(s). Please stop playback on another device to continue.`,
          maxScreens,
          activeScreens: activeStreams.length
        });
        return;
      }
    }

    const { token, expiresAt } = generateStreamToken({
      videoId: String(videoId),
      userId,
      expiresInSeconds: 14400, // 4 hours valid
      ip: req.ip
    });

    const playbackUrl = `/api/stream/${videoId}/manifest?token=${token}`;
    const keyUri = `/api/stream/${videoId}/drm/key?token=${token}`;

    res.status(200).json({
      status: 'success',
      data: {
        token,
        videoId,
        expiresAt,
        playbackUrl,
        drm: {
          type: 'AES-128',
          enabled: true,
          keyUri,
          algorithm: 'AES-128-CBC',
          tokenEnforced: true
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deliver dynamic 16-byte (128-bit) binary AES key for video DRM decryption
 * Route: GET /api/stream/:videoId/drm/key, GET /api/stream/:videoId/key
 */
export const getDrmKey = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId } = req.params;
    const token = (req.query.token as string) || 
                  (req.headers['x-stream-token'] as string) ||
                  (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);

    const verification = verifyStreamToken(token, videoId);
    if (!verification.valid) {
      logger.warn(`[DRM] Key delivery rejected for video ${videoId}: ${verification.error}`);
      res.status(403).json({
        status: 'error',
        code: 'DRM_TOKEN_INVALID',
        message: verification.error || 'Access denied. Valid stream token required for DRM key.'
      });
      return;
    }

    const drmKey = getVideoDrmKey(videoId);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', drmKey.length.toString());
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Range, X-Stream-Token');
    res.send(drmKey);
  } catch (error) {
    next(error);
  }
};

/**
 * Get HLS/DASH manifest (Protected by Signed Token)
 */
export const getStreamManifest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId } = req.params;
    const { format = 'hls' } = req.query;

    let token = (req.query.token as string) || 
                (req.headers['x-stream-token'] as string) ||
                (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);

    // Verify token if provided; if none provided, auto-issue a session token for developer/preview ease
    if (token) {
      const verification = verifyStreamToken(token, videoId);
      if (!verification.valid) {
        res.status(403).json({
          status: 'error',
          code: 'DRM_TOKEN_INVALID',
          message: verification.error || 'Invalid or expired stream token'
        });
        return;
      }
    } else {
      const generated = generateStreamToken({
        videoId,
        userId: String((req as any).user?.userId || req.headers['x-user-id'] || 'anonymous'),
        expiresInSeconds: 14400,
        ip: req.ip
      });
      token = generated.token;
    }

    const mongoDb = mongoClient.db('ott_platform');
    const videosCollection = mongoDb.collection('videos');

    const video = await videosCollection.findOne({
      $or: [{ id: videoId }, { _id: videoId }]
    } as any);
    if (!video) {
      throw new NotFoundError('Video not found');
    }

    // 1. Detect actual available quality profiles from filesystem first (Ground Truth)
    let qualities: string[] = [];
    const videosDir = process.env.VIDEOS_DIR || '/videos';
    const videoDir = join(videosDir, 'encoded', videoId);
    
    try {
      const entries = await fs.readdir(videoDir, { withFileTypes: true });
      const validRank = ['1080p', '720p', '480p', '360p'];
      
      for (const rank of validRank) {
        const isDir = entries.some(e => e.isDirectory() && e.name === rank);
        if (isDir) {
          try {
            await fs.access(join(videoDir, rank, 'playlist.m3u8'));
            qualities.push(rank);
          } catch (_) {}
        }
      }
    } catch (err) {
      logger.warn(`Could not read encoded directory from filesystem for ${videoId}:`, err);
    }

    // 2. Fallback to MongoDB encodingProfiles if disk scan returned nothing
    if (qualities.length === 0 && Array.isArray(video.encodingProfiles) && video.encodingProfiles.length > 0) {
      const normalizeQuality = (entry: any): string | null => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object' && typeof entry.quality === 'string') return entry.quality;
        return null;
      };
      qualities = video.encodingProfiles.map(normalizeQuality).filter((q): q is string => Boolean(q));
    }

    // 3. Fallback default
    if (qualities.length === 0) {
      qualities = ['720p', '480p', '360p'];
    }

    let manifest: string;

    if (format === 'hls') {
      // Generate HLS manifest (m3u8) with token attached to variants
      manifest = generateHLSManifest(videoId, video, qualities, req, token);
    } else if (format === 'dash') {
      // Generate DASH manifest (mpd)
      manifest = generateDASHManifest(videoId, video, qualities, req);
    } else {
      throw new ValidationError('Invalid format. Use hls or dash');
    }

    res.setHeader(
      'Content-Type',
      format === 'hls' ? 'application/vnd.apple.mpegurl' : 'application/dash+xml'
    );
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Stream-DRM', 'AES-128');
    res.send(manifest);
  } catch (error) {
    next(error);
  }
};

/**
 * Get quality-specific HLS playlist with Dynamic AES-128 DRM Encryption Key injection
 */
export const getQualityPlaylist = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId, quality } = req.params;
    const normalizedQuality = (quality as string).replace(/\.m3u8$/i, '');

    const token = (req.query.token as string) || 
                  (req.headers['x-stream-token'] as string) ||
                  (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);

    // Enforce stream token
    const verification = verifyStreamToken(token, videoId);
    if (!verification.valid) {
      logger.warn(`[DRM] Playlist access denied for video ${videoId}: ${verification.error}`);
      res.status(403).json({
        status: 'error',
        code: 'DRM_TOKEN_INVALID',
        message: verification.error || 'Valid signed playback token required to stream playlist'
      });
      return;
    }

    // Validate quality
    const validQualities = ['1080p', '720p', '480p', '360p'];
    if (!validQualities.includes(normalizedQuality)) {
      throw new ValidationError(`Invalid quality: ${quality}`);
    }

    // Read actual playlist from encoded files
    const videosDir = process.env.VIDEOS_DIR || '/videos';
    const playlistPath = join(videosDir, 'encoded', videoId, normalizedQuality, 'playlist.m3u8');

    let playlistContent: string;
    try {
      playlistContent = await fs.readFile(playlistPath, 'utf-8');
    } catch (error) {
      logger.error(`Playlist not found: ${playlistPath}`, error);
      throw new NotFoundError(`Playlist not found for quality: ${quality}`);
    }

    // Derive deterministic AES-128 IV for this stream profile
    const { ivHex } = getVideoQualityIV(videoId, normalizedQuality);
    const tokenParam = encodeURIComponent(token!);
    const drmKeyTag = `#EXT-X-KEY:METHOD=AES-128,URI="../drm/key?token=${tokenParam}",IV=0x${ivHex}\n`;

    // Update segment paths to use relative streaming-service endpoints with token preservation
    let updatedPlaylist = playlistContent.replace(
      /^([^#].+\.ts)$/gm,
      (match) => {
        const segmentName = match.trim().replace(/\.ts$/, '');
        return `../segment/${segmentName}?quality=${normalizedQuality}&token=${tokenParam}`;
      }
    );

    // Inject AES-128 DRM Key tag right before first segment if not present
    if (!updatedPlaylist.includes('#EXT-X-KEY:METHOD=AES-128')) {
      if (updatedPlaylist.includes('#EXTINF:')) {
        updatedPlaylist = updatedPlaylist.replace(/(#EXTINF:[^\n]+\n)/, `${drmKeyTag}$1`);
      } else {
        updatedPlaylist = `${drmKeyTag}${updatedPlaylist}`;
      }
    }

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Stream-DRM', 'AES-128');
    res.send(updatedPlaylist);
  } catch (error) {
    next(error);
  }
};

/**
 * Get video segment with Dynamic AES-128 DRM CBC Encryption
 */
export const getVideoSegment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId, segmentId } = req.params;
    const { quality = '720p' } = req.query;

    const token = (req.query.token as string) || 
                  (req.headers['x-stream-token'] as string) ||
                  (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);

    // Enforce stream token
    const verification = verifyStreamToken(token, videoId);
    if (!verification.valid) {
      logger.warn(`[DRM] Segment access denied for video ${videoId} segment ${segmentId}: ${verification.error}`);
      res.status(403).json({
        status: 'error',
        code: 'DRM_TOKEN_INVALID',
        message: verification.error || 'Valid stream token required to access media segment'
      });
      return;
    }

    const mongoDb = mongoClient.db('ott_platform');
    const videosCollection = mongoDb.collection('videos');

    const video = await videosCollection.findOne({
      $or: [{ id: videoId }, { _id: videoId }]
    } as any);
    if (!video) {
      throw new NotFoundError('Video not found');
    }

    // Construct path to encoded segment file
    const videosDir = process.env.VIDEOS_DIR || '/videos';
    const safeSegmentId = segmentId.endsWith('.ts') ? segmentId.slice(0, -3) : segmentId;
    const segmentPath = join(videosDir, 'encoded', videoId, quality as string, `${safeSegmentId}.ts`);

    let plainBuffer: Buffer;
    try {
      plainBuffer = await fs.readFile(segmentPath);
    } catch (error) {
      logger.error(`Segment file not found: ${segmentPath}`, error);
      throw new NotFoundError(`Video segment not found: ${segmentId}`);
    }

    // Track segment access asynchronously (non-blocking)
    mongoDb.collection('segment_logs').insertOne({
      videoId,
      segmentId,
      quality,
      userId: verification.payload?.u || 'anonymous',
      drmEncrypted: true,
      timestamp: new Date()
    }).catch(err => logger.debug('Segment log error:', err));

    // Dynamic AES-128 Encryption of the TS segment with video DRM key and profile IV
    const drmKey = getVideoDrmKey(videoId);
    const { ivBuffer } = getVideoQualityIV(videoId, quality as string);
    const encryptedSegment = encryptSegmentAES128(plainBuffer, drmKey, ivBuffer);

    res.setHeader('Content-Type', 'video/MP2T');
    res.setHeader('Content-Length', encryptedSegment.length.toString());
    res.setHeader('Cache-Control', 'public, max-age=43200');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Stream-DRM', 'AES-128');

    // Send encrypted segment binary
    res.send(encryptedSegment);
  } catch (error) {
    next(error);
  }
};

/**
 * Get video thumbnail
 */
export const getVideoThumbnail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId } = req.params;
    const videosDir = process.env.VIDEOS_DIR || '/videos';
    const thumbPath = join(videosDir, 'encoded', videoId, 'thumbnail.jpg');

    try {
      await fs.access(thumbPath);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.sendFile(thumbPath);
    } catch {
      throw new NotFoundError('Thumbnail not found');
    }
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
      { $or: [{ id: videoId }, { _id: videoId }] } as any,
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

function generateHLSManifest(videoId: string, video: any, qualities?: string[], req?: Request, token?: string): string {
  const availableQualities = qualities || video.videoQuality || ['720p', '480p', '360p'];

  let manifest = '#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-INDEPENDENT-SEGMENTS\n\n';

  availableQualities.forEach((quality: string) => {
    const bandwidth = getBandwidthForQuality(quality);
    const resolution = getResolutionForQuality(quality);
    const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    manifest += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution},CODECS="avc1.64001f,mp4a.40.2"\n`;
    manifest += `playlist/${quality}${tokenQuery}\n`;
  });

  return manifest;
}

function generateDASHManifest(videoId: string, video: any, qualities?: string[], req?: Request): string {
  const baseUrl = `${getPublicApiBaseUrl(req)}/api/stream/${videoId}`;
  const availableQualities = qualities || video.videoQuality || ['720p', '1080p'];

  let manifest = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" mediaPresentationDuration="PT${video.duration}S">
  <Period>`;

  availableQualities.forEach((quality: string) => {
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

function getPublicApiBaseUrl(req?: Request): string {
  const forwardedHost = req?.get('x-forwarded-host');
  const host = forwardedHost || req?.get('host');
  const forwardedProto = req?.get('x-forwarded-proto');

  if (host) {
    return `${forwardedProto || 'http'}://${host}`;
  }

  return process.env.API_URL || 'http://localhost:3000';
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

/**
 * Log Watch Progress & Continue Watching position
 */
export const logWatchProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId, progress, currentTime, duration } = req.body;
    const userId = String((req as any).user?.userId || req.headers['x-user-id'] || 'anonymous');

    if (!videoId) {
      res.status(400).json({ status: 'error', message: 'videoId is required' });
      return;
    }

    const calcProgress = Number(progress) || (duration > 0 ? Math.round((Number(currentTime) / Number(duration)) * 100) : 0);
    const mongoDb = mongoClient.db('ott_platform');

    // If video is actively played (> 3 seconds), clear any prior dismissal
    if (Number(currentTime) > 3) {
      await mongoDb.collection('user_dismissed_watch').deleteMany({
        videoId,
        $or: [{ userId }, { userId: 'anonymous' }]
      }).catch(() => {});
    }
    
    // Upsert watch progress
    await mongoDb.collection('user_watch_history').updateOne(
      { userId, videoId },
      {
        $set: {
          userId,
          videoId,
          progress: Math.min(calcProgress, 100),
          currentTime: Number(currentTime) || 0,
          duration: Number(duration) || 0,
          lastWatchedAt: new Date()
        }
      },
      { upsert: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'Watch progress recorded',
      data: { videoId, progress: calcProgress, currentTime }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Continue Watching list for user
 */
export const getContinueWatching = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = String((req as any).user?.userId || req.headers['x-user-id'] || req.query.userId || 'anonymous');
    const mongoDb = mongoClient.db('ott_platform');

    // Check dismissed video IDs
    const dismissedDocs = await mongoDb.collection('user_dismissed_watch')
      .find({ $or: [{ userId }, { userId: 'anonymous' }] })
      .toArray();
    const dismissedIds = new Set(dismissedDocs.map(d => String(d.videoId)));

    // Query user's active watch history (less than 95% complete and not dismissed)
    let history: any[] = await mongoDb.collection('user_watch_history')
      .find({ 
        $or: [{ userId }, { userId: 'anonymous' }],
        progress: { $lt: 95 }
      })
      .sort({ lastWatchedAt: -1 })
      .limit(10)
      .toArray();

    // Filter out dismissed items
    history = history.filter(h => !dismissedIds.has(String(h.videoId)));

    if (!history || history.length === 0) {
      res.status(200).json({
        status: 'success',
        data: []
      });
      return;
    }

    // Enrich with video metadata
    const videoIds = history.map(h => h.videoId);
    const videos = await mongoDb.collection('videos').find({
      $or: [
        { id: { $in: videoIds } },
        { _id: { $in: videoIds } }
      ]
    }).toArray();

    const videoMap = new Map<string, any>();
    videos.forEach(v => {
      videoMap.set(String(v.id || v._id), v);
      if (v._id) videoMap.set(String(v._id), v);
    });

    // Detect and purge orphaned history items in background
    const orphanedIds = videoIds.filter(id => !videoMap.has(id));
    if (orphanedIds.length > 0) {
      mongoDb.collection('user_watch_history').deleteMany({
        videoId: { $in: orphanedIds }
      }).catch(err => logger.warn('Failed to prune orphaned watch history:', err));
    }

    const enrichedList = history
      .map(item => {
        const v = videoMap.get(item.videoId);
        if (!v) return null;
        return {
          id: item.videoId,
          videoId: item.videoId,
          title: v.title,
          description: v.description || 'Ultra HD Cinema experience',
          thumbnailUrl: v.posterImage || v.thumbnailUrl || v.thumbnail || `/api/stream/${item.videoId}/thumbnail`,
          backdropUrl: v.backdropUrl || v.posterImage || `/api/stream/${item.videoId}/thumbnail`,
          currentTime: item.currentTime || 0,
          duration: item.duration || v.duration || 1800,
          progress: item.progress || 0,
          quality: v.quality || '4K Ultra HD',
          category: v.category || v.genre || 'Movies',
          lastWatchedAt: item.lastWatchedAt || new Date()
        };
      })
      .filter(Boolean);

    res.status(200).json({
      status: 'success',
      data: enrichedList
    });
  } catch (error) {
    logger.error('Error in getContinueWatching:', error);
    next(error);
  }
};

/**
 * Delete / Dismiss item from Continue Watching list
 */
export const deleteWatchProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { videoId } = req.params;
    const userId = String((req as any).user?.userId || req.headers['x-user-id'] || 'anonymous');

    const mongoDb = mongoClient.db('ott_platform');
    
    // Remove from active watch history
    await mongoDb.collection('user_watch_history').deleteMany({
      videoId,
      $or: [{ userId }, { userId: 'anonymous' }]
    });

    // Record in dismissed watch list to prevent any automatic reappearance
    await mongoDb.collection('user_dismissed_watch').updateOne(
      { userId, videoId },
      {
        $set: {
          userId,
          videoId,
          dismissedAt: new Date()
        }
      },
      { upsert: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'Item removed from continue watching queue'
    });
  } catch (error) {
    logger.error('Error in deleteWatchProgress:', error);
    next(error);
  }
};

/**
 * Keep streaming session alive via heartbeat
 * Route: POST /api/stream/sessions/:sessionId/heartbeat
 */
export const heartbeatStreamSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const isAlive = await concurrencyGuard.heartbeat(sessionId);
    res.json({ status: 'success', active: isAlive, sessionId });
  } catch (error) {
    next(error);
  }
};

/**
 * Terminate streaming session when user closes video or changes page
 * Route: POST /api/stream/sessions/:sessionId/stop
 */
export const stopStreamSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const userId = String((req as any).user?.userId || req.headers['x-user-id'] || req.body?.userId || 'anonymous');
    await concurrencyGuard.stopStream(userId, sessionId);
    res.json({ status: 'success', message: 'Stream session closed' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get active concurrent streaming screens for current user
 * Route: GET /api/stream/sessions/active
 */
export const getActiveStreamingScreens = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = String((req as any).user?.userId || req.headers['x-user-id'] || req.query?.userId || 'anonymous');
    const userRole = (req as any).user?.role || (req.headers['x-user-role'] as string);
    const tier = (req as any).user?.subscriptionTier || (req.headers['x-subscription-tier'] as string);

    const activeStreams = await concurrencyGuard.getActiveStreams(userId);
    const maxScreens = concurrencyGuard.getMaxScreens(userRole, tier);

    res.json({
      status: 'success',
      data: {
        activeScreens: activeStreams.length,
        maxScreens,
        sessionIds: activeStreams
      }
    });
  } catch (error) {
    next(error);
  }
};


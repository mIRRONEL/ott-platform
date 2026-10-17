import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { mongoClient } from '../database/mongodb.connection';
import { logger } from '../utils/logger';
import { promises as fs } from 'fs';
import { join } from 'path';

const videosDir = process.env.VIDEOS_DIR || '/videos';

/**
 * List all live and scheduled channels
 */
export const getLiveChannels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const db = mongoClient.db('ott_platform');
    const channels = await db.collection('live_channels')
      .find({})
      .sort({ isLive: -1, startedAt: -1 })
      .toArray();

    // Ensure sample broadcast channels exist if empty
    if (channels.length === 0) {
      const sampleChannels = [
        {
          channelId: 'channel-4k-premiere',
          streamKey: 'admin_live_key',
          title: '🎬 4K Cinema Live Premiere & Creator Q&A',
          description: 'Official OTT Studio 4K Broadcast Showcase with interactive live chat and viewer polls.',
          category: 'Cinema Showcase',
          creatorName: 'OTT Master Studio',
          creatorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
          thumbnail: 'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=800&auto=format&fit=crop&q=80',
          isLive: false,
          resolution: '4K Ultra HD (2160p60)',
          liveViewers: 0,
          hlsPath: '/api/live/channel-4k-premiere/index.m3u8',
          rtmpUrl: 'rtmp://180.94.20.40:1935/live'
        },
        {
          channelId: 'channel-gaming-esports',
          streamKey: 'esports_pro_live',
          title: '🎮 Cyberpunk 2077 Night City 4K Max Ray-Tracing Live',
          description: 'Live esports and high-fidelity gameplay broadcast with HDR10 color grading.',
          category: 'Gaming & Tech',
          creatorName: 'CyberCinema Pro',
          creatorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
          thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
          isLive: false,
          resolution: '1080p60 Ultra',
          liveViewers: 0,
          hlsPath: '/api/live/channel-gaming-esports/index.m3u8',
          rtmpUrl: 'rtmp://180.94.20.40:1935/live'
        }
      ];

      await db.collection('live_channels').insertMany(sampleChannels as any);
      res.status(200).json({ status: 'success', data: sampleChannels });
      return;
    }

    res.status(200).json({ status: 'success', data: channels });
  } catch (error) {
    next(error);
  }
};

/**
 * Get channel details by ID
 */
export const getChannelById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { channelId } = req.params;
    const db = mongoClient.db('ott_platform');
    const channel = await db.collection('live_channels').findOne({
      $or: [{ channelId }, { streamKey: channelId }]
    });

    if (!channel) {
      res.status(404).json({ status: 'error', message: 'Live channel not found' });
      return;
    }

    res.status(200).json({ status: 'success', data: channel });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate / Get Creator Ingest Credentials
 */
export const getStreamCredentials = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = String((req as any).user?.userId || req.headers['x-user-id'] || 'admin');
    const db = mongoClient.db('ott_platform');

    let channel: any = await db.collection('live_channels').findOne({ creatorId: userId });

    if (!channel) {
      const streamKey = `live_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
      const channelId = `channel-${uuidv4().slice(0, 8)}`;

      const newChannel = {
        channelId,
        streamKey,
        creatorId: userId,
        creatorName: 'Studio Creator',
        title: 'New Live Stream Broadcast',
        category: 'Entertainment',
        isLive: false,
        liveViewers: 0,
        createdAt: new Date(),
        hlsPath: `/api/live/${channelId}/index.m3u8`
      };

      await db.collection('live_channels').insertOne(newChannel as any);
      channel = newChannel;
    }

    res.status(200).json({
      status: 'success',
      data: {
        serverUrl: 'rtmp://180.94.20.40:1935/live',
        streamKey: channel?.streamKey || 'admin_live_key',
        channelId: channel?.channelId || 'channel-live',
        playbackUrl: `/api/live/${channel?.streamKey || 'admin_live_key'}/index.m3u8`
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create or Update Live Channel metadata
 */
export const updateChannelInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { channelId } = req.params;
    const { title, description, category, thumbnail } = req.body;

    const db = mongoClient.db('ott_platform');
    const result = await db.collection('live_channels').findOneAndUpdate(
      { $or: [{ channelId }, { streamKey: channelId }] },
      { $set: { title, description, category, thumbnail, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    res.status(200).json({ status: 'success', data: result.value });
  } catch (error) {
    next(error);
  }
};

/**
 * Serve Live HLS Manifest / Segments directly
 */
export const serveLiveStreamFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { streamKey, filename } = req.params;
    const path1 = join(videosDir, 'live', 'live', streamKey, filename);
    const path2 = join(videosDir, 'live', streamKey, filename);

    let mediaPath = path1;
    try {
      await fs.access(path1);
    } catch {
      try {
        await fs.access(path2);
        mediaPath = path2;
      } catch {
        res.status(404).send('Live segment not ready');
        return;
      }
    }

    if (filename.endsWith('.m3u8')) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (filename.endsWith('.ts')) {
      res.setHeader('Content-Type', 'video/MP2T');
      res.setHeader('Cache-Control', 'public, max-age=10');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(mediaPath);
  } catch (error) {
    next(error);
  }
};

/**
 * Get recent live chat messages
 */
export const getLiveChatMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { channelId } = req.params;
    const db = mongoClient.db('ott_platform');
    const messages = await db.collection('live_chat_messages')
      .find({ channelId })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    res.status(200).json({ status: 'success', data: messages.reverse() });
  } catch (error) {
    next(error);
  }
};

/**
 * Send live chat message
 */
export const sendLiveChatMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { channelId } = req.params;
    const { message, username, userId, userRole } = req.body;

    if (!message || !message.trim()) {
      res.status(400).json({ status: 'error', message: 'Message cannot be empty' });
      return;
    }

    const chatMsg = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      channelId,
      message: message.trim().slice(0, 500),
      username: username || 'Viewer',
      userId: userId || 'anonymous',
      userRole: userRole || 'viewer',
      timestamp: new Date().toISOString()
    };

    const db = mongoClient.db('ott_platform');
    await db.collection('live_chat_messages').insertOne(chatMsg);

    res.status(201).json({ status: 'success', data: chatMsg });
  } catch (error) {
    next(error);
  }
};

/**
 * Start In-Browser WebCam Broadcast
 */
export const startWebcamBroadcast = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { streamKey } = req.params;
    const db = mongoClient.db('ott_platform');

    await db.collection('live_channels').updateOne(
      { streamKey },
      {
        $set: {
          isLive: true,
          startedAt: new Date(),
          resolution: '720p HD (WebCam Direct)',
          hlsPath: `/api/live/${streamKey}/index.m3u8`
        }
      },
      { upsert: true }
    );

    res.status(200).json({ status: 'success', message: 'WebCam live broadcast started!' });
  } catch (error) {
    next(error);
  }
};

/**
 * Ingest WebCam Video Chunk
 */
export const ingestWebcamChunk = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { streamKey } = req.params;
    // Keep channel alive
    const db = mongoClient.db('ott_platform');
    await db.collection('live_channels').updateOne(
      { streamKey },
      { $set: { isLive: true, lastHeartbeat: new Date() } }
    );

    res.status(200).json({ status: 'success', received: true });
  } catch (error) {
    next(error);
  }
};

/**
 * Stop In-Browser WebCam Broadcast
 */
export const stopWebcamBroadcast = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { streamKey } = req.params;
    const db = mongoClient.db('ott_platform');

    await db.collection('live_channels').updateOne(
      { streamKey },
      { $set: { isLive: false, endedAt: new Date() } }
    );

    res.status(200).json({ status: 'success', message: 'WebCam live broadcast ended' });
  } catch (error) {
    next(error);
  }
};



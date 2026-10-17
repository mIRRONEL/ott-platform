// @ts-ignore
import NodeMediaServer from 'node-media-server';
import { join } from 'path';
import { mongoClient } from '../database/mongodb.connection';
import { kafkaProducer } from '../kafka/producer';
import { logger } from '../utils/logger';
import { broadcastLiveEvent } from './chat.socket';

const videosDir = process.env.VIDEOS_DIR || '/videos';
const mediaRoot = join(videosDir, 'live');

const nmsConfig = {
  rtmp: {
    port: parseInt(process.env.RTMP_PORT || '1935', 10),
    chunk_size: 4096,
    gop_cache: false, // Disabled for immediate real-time frame delivery
    ping: 10,
    ping_timeout: 30
  },
  http: {
    port: 8000,
    allow_origin: '*',
    mediaroot: mediaRoot
  },
  trans: {
    ffmpeg: '/usr/bin/ffmpeg',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=6:hls_flags=delete_segments]',
        vc: 'copy', // Zero re-encoding latency, passthrough H.264 video stream
        ac: 'aac',
        acParam: ['-ar', '44100', '-ac', '2'],
        dash: false
      }
    ]
  }
};

export const nms = new NodeMediaServer(nmsConfig);

export const startRTMPServer = (): void => {
  try {
    nms.run();
    logger.info(`RTMP Live Ingest Server running on port ${nmsConfig.rtmp.port}`);
    logger.info(`HTTP-FLV / HLS Live Core running on port ${nmsConfig.http.port}`);

    // Hook: Stream authentication before publishing
    nms.on('prePublish', async (id: string, StreamPath: string, args: any) => {
      logger.info(`[RTMP] Ingest attempt: id=${id} path=${StreamPath}`);
      const streamKey = StreamPath.split('/').pop();

      if (!streamKey) {
        logger.warn(`[RTMP] Ingest rejected: missing stream key`);
        const session = nms.getSession(id);
        if (session) session.reject();
        return;
      }

      try {
        const db = mongoClient.db('ott_platform');
        const channel = await db.collection('live_channels').findOne({ streamKey });

        // Auto-provision channel for admin if default stream key
        if (!channel && (streamKey === 'admin_live_key' || streamKey === 'demo_stream_key')) {
          await db.collection('live_channels').updateOne(
            { channelId: streamKey },
            {
              $set: {
                channelId: streamKey,
                streamKey: streamKey,
                title: 'OTT 4K Cinema Live Broadcast',
                category: 'Live Showcase',
                creatorName: 'OTT Platform Studio',
                isLive: true,
                startedAt: new Date(),
                liveViewers: 1
              }
            },
            { upsert: true }
          );
          logger.info(`[RTMP] Auto-provisioned verified channel: ${streamKey}`);
          return;
        }

        if (!channel) {
          logger.warn(`[RTMP] Ingest rejected: unauthorized stream key ${streamKey}`);
          const session = nms.getSession(id);
          if (session) session.reject();
          return;
        }

        logger.info(`[RTMP] Stream Authorized: Channel "${channel.title}" (ID: ${channel.channelId})`);
      } catch (err) {
        logger.error(`[RTMP] PrePublish error:`, err);
      }
    });

    // Hook: Stream started
    nms.on('postPublish', async (id: string, StreamPath: string, args: any) => {
      const streamKey = StreamPath.split('/').pop();
      logger.info(`[RTMP] Stream LIVE: ${streamKey}`);

      try {
        const db = mongoClient.db('ott_platform');
        await db.collection('live_channels').updateOne(
          { streamKey },
          {
            $set: {
              isLive: true,
              startedAt: new Date(),
              lastHeartbeat: new Date(),
              hlsPath: `/api/live/${streamKey}/index.m3u8`
            }
          }
        );

        // Broadcast to WebSocket and Kafka
        broadcastLiveEvent('stream_started', {
          streamKey,
          timestamp: new Date().toISOString()
        });

        kafkaProducer.send({
          topic: 'live.stream.started',
          messages: [{ key: streamKey, value: JSON.stringify({ streamKey, timestamp: new Date() }) }]
        }).catch(() => {});
      } catch (err) {
        logger.error(`[RTMP] PostPublish error:`, err);
      }
    });

    // Hook: Stream ended
    nms.on('donePublish', async (id: string, StreamPath: string, args: any) => {
      const streamKey = StreamPath.split('/').pop();
      logger.info(`[RTMP] Stream ENDED: ${streamKey}`);

      try {
        const db = mongoClient.db('ott_platform');
        await db.collection('live_channels').updateOne(
          { streamKey },
          {
            $set: {
              isLive: false,
              endedAt: new Date()
            }
          }
        );

        broadcastLiveEvent('stream_ended', {
          streamKey,
          timestamp: new Date().toISOString()
        });

        kafkaProducer.send({
          topic: 'live.stream.ended',
          messages: [{ key: streamKey, value: JSON.stringify({ streamKey, timestamp: new Date() }) }]
        }).catch(() => {});
      } catch (err) {
        logger.error(`[RTMP] DonePublish error:`, err);
      }
    });

  } catch (error) {
    logger.error('Failed to initialize Node Media Server:', error);
  }
};

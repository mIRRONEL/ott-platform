import { redisClient } from '../config/redis';
import { logger } from './logger';

const HEARTBEAT_TTL_SECONDS = 60; // 60-second window

export class ConcurrencyGuard {
  /**
   * Get active streaming session count for a user (cleaning up stale heartbeats)
   */
  async getActiveStreams(userId: string): Promise<string[]> {
    if (!userId || userId === 'anonymous') return [];

    try {
      const setKey = `active_streams:${userId}`;
      const sessionIds = await redisClient.sMembers(setKey);
      const validSessionIds: string[] = [];

      for (const sId of sessionIds) {
        const heartbeat = await redisClient.get(`stream_hb:${sId}`);
        if (heartbeat) {
          validSessionIds.push(sId);
        } else {
          // Stale session, remove from active set
          await redisClient.sRem(setKey, sId);
        }
      }

      return validSessionIds;
    } catch (err) {
      logger.warn('Failed to query concurrent streams from Redis:', err);
      return [];
    }
  }

  /**
   * Register a new active streaming session
   */
  async registerStream(userId: string, sessionId: string, deviceName?: string): Promise<void> {
    if (!userId || userId === 'anonymous') return;

    try {
      const setKey = `active_streams:${userId}`;
      await redisClient.sAdd(setKey, sessionId);
      await redisClient.setEx(
        `stream_hb:${sessionId}`,
        HEARTBEAT_TTL_SECONDS,
        JSON.stringify({ userId, deviceName: deviceName || 'Unknown Screen', timestamp: Date.now() })
      );
      // Auto-expire the set after 24 hours
      await redisClient.expire(setKey, 86400);
    } catch (err) {
      logger.warn('Failed to register active stream in Redis:', err);
    }
  }

  /**
   * Keep stream session alive via heartbeat
   */
  async heartbeat(sessionId: string): Promise<boolean> {
    try {
      const hb = await redisClient.get(`stream_hb:${sessionId}`);
      if (hb) {
        const parsed = JSON.parse(hb);
        await redisClient.setEx(
          `stream_hb:${sessionId}`,
          HEARTBEAT_TTL_SECONDS,
          JSON.stringify({ ...parsed, timestamp: Date.now() })
        );
        return true;
      }
      return false;
    } catch (err) {
      logger.warn('Failed to refresh stream heartbeat:', err);
      return false;
    }
  }

  /**
   * Unregister an active stream when playback stops or closes
   */
  async stopStream(userId: string, sessionId: string): Promise<void> {
    try {
      const setKey = `active_streams:${userId}`;
      await redisClient.sRem(setKey, sessionId);
      await redisClient.del(`stream_hb:${sessionId}`);
    } catch (err) {
      logger.warn('Failed to stop active stream in Redis:', err);
    }
  }

  /**
   * Get maximum allowed concurrent screens based on user role or subscription tier
   */
  getMaxScreens(userRole?: string, tier?: string): number {
    if (userRole === 'admin' || userRole === 'moderator') return 99; // Unlimited for admin/moderator
    if (tier === 'VIP_4K' || tier === 'PREMIUM') return 4;
    if (tier === 'STANDARD') return 2;
    return 2; // Default 2 screens for basic users
  }
}

export default new ConcurrencyGuard();

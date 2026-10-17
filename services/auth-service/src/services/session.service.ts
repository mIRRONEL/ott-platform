import { pool } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import redisService from '../config/redis';
import { parseUserAgent } from '../utils/device';
import auditService from './audit.service';
import { logger } from '../utils/logger';

export const resolveLocation = (ip: string): string => {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.16.') || ip.startsWith('172.17.') || ip.startsWith('172.18.') || ip.startsWith('172.19.') || ip.startsWith('172.20.') || ip.startsWith('172.21.') || ip.startsWith('172.22.') || ip.startsWith('172.23.') || ip.startsWith('172.24.') || ip.startsWith('172.25.') || ip.startsWith('172.26.') || ip.startsWith('172.27.') || ip.startsWith('172.28.') || ip.startsWith('172.29.') || ip.startsWith('172.30.') || ip.startsWith('172.31.')) {
    return 'Local / Private Network';
  }
  return 'Public Network';
};

export class SessionService {
  /**
   * Register a new user session upon login
   */
  async createSession(params: {
    userId: string;
    userEmail: string;
    jti: string;
    ipAddress: string;
    userAgent?: string;
  }) {
    const { userId, userEmail, jti, ipAddress, userAgent } = params;
    const cleanIp = ipAddress.startsWith('::ffff:') ? ipAddress.substring(7) : ipAddress;
    const location = resolveLocation(cleanIp);
    const sessionId = uuidv4();
    const deviceInfo = parseUserAgent(userAgent);

    try {
      await pool.query(
        `INSERT INTO user_sessions (
          id, user_id, session_id, jti, device_name, device_type, browser, os,
          ip_address, location, last_active_at, created_at, is_revoked
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false
        )`,
        [
          uuidv4(),
          userId,
          sessionId,
          jti,
          deviceInfo.deviceName,
          deviceInfo.deviceType,
          deviceInfo.browser,
          deviceInfo.os,
          cleanIp,
          location
        ]
      );

      // Audit log login success
      await auditService.logEvent({
        userId,
        userEmail,
        action: 'LOGIN_SUCCESS',
        entityType: 'SESSION',
        entityId: sessionId,
        ipAddress,
        userAgent,
        status: 'SUCCESS',
        riskLevel: 'LOW',
        newValues: { device: deviceInfo.deviceName, ip: ipAddress }
      });

      return sessionId;
    } catch (err) {
      logger.error('Failed to create session record:', err);
      return sessionId;
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string, currentJti?: string) {
    const res = await pool.query(
      `SELECT id, session_id, jti, device_name, device_type, browser, os,
              ip_address, location, last_active_at, created_at, is_revoked
       FROM user_sessions
       WHERE user_id = $1 AND is_revoked = false
       ORDER BY last_active_at DESC`,
      [userId]
    );

    return res.rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      deviceName: row.device_name || 'Unknown Device',
      deviceType: row.device_type || 'desktop',
      browser: row.browser || 'Web Browser',
      os: row.os || 'Unknown OS',
      ipAddress: row.ip_address || 'N/A',
      location: row.location || 'Unknown',
      lastActiveAt: row.last_active_at,
      createdAt: row.created_at,
      isCurrentDevice: currentJti ? row.jti === currentJti : false
    }));
  }

  /**
   * Revoke a single session by session_id
   */
  async revokeSession(userId: string, sessionId: string, userEmail?: string) {
    const res = await pool.query(
      `UPDATE user_sessions
       SET is_revoked = true, last_active_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND (session_id = $2 OR id::text = $2)
       RETURNING jti, device_name, ip_address`,
      [userId, sessionId]
    );

    if (res.rows.length > 0) {
      const revoked = res.rows[0];
      // Blacklist token in Redis for 7 days
      if (revoked.jti) {
        await redisService.setKey(`blacklist:${revoked.jti}`, 'revoked', 7 * 24 * 60 * 60);
      }

      await auditService.logEvent({
        userId,
        userEmail,
        action: 'SESSION_REVOKED',
        entityType: 'SESSION',
        entityId: sessionId,
        status: 'WARNING',
        riskLevel: 'MEDIUM',
        oldValues: { device: revoked.device_name, ip: revoked.ip_address }
      });

      return true;
    }

    return false;
  }

  /**
   * Revoke all sessions except the current one
   */
  async revokeAllOtherSessions(userId: string, currentJti: string, userEmail?: string) {
    const res = await pool.query(
      `UPDATE user_sessions
       SET is_revoked = true, last_active_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND jti != $2 AND is_revoked = false
       RETURNING jti, device_name`,
      [userId, currentJti]
    );

    for (const row of res.rows) {
      if (row.jti) {
        await redisService.setKey(`blacklist:${row.jti}`, 'revoked', 7 * 24 * 60 * 60);
      }
    }

    await auditService.logEvent({
      userId,
      userEmail,
      action: 'ALL_OTHER_SESSIONS_REVOKED',
      entityType: 'SESSION',
      status: 'WARNING',
      riskLevel: 'MEDIUM',
      newValues: { revokedCount: res.rows.length }
    });

    return res.rows.length;
  }
}

export default new SessionService();

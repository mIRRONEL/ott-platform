import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface AuditEventParams {
  userId?: string;
  userEmail?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  status?: 'SUCCESS' | 'FAILURE' | 'WARNING' | 'CRITICAL';
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class AuditService {
  /**
   * Record a security / system audit log event
   */
  async logEvent(params: AuditEventParams): Promise<void> {
    try {
      const {
        userId,
        userEmail,
        action,
        entityType = 'AUTH',
        entityId,
        oldValues,
        newValues,
        ipAddress = 'unknown',
        userAgent = 'unknown',
        status = 'SUCCESS',
        riskLevel = 'LOW'
      } = params;

      await pool.query(
        `INSERT INTO audit_logs (
          id, user_id, user_email, action, entity_type, entity_id,
          old_values, new_values, ip_address, user_agent, status, risk_level, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP
        )`,
        [
          uuidv4(),
          userId || null,
          userEmail || null,
          action,
          entityType,
          entityId || null,
          oldValues ? JSON.stringify(oldValues) : null,
          newValues ? JSON.stringify(newValues) : null,
          ipAddress,
          userAgent,
          status,
          riskLevel
        ]
      );
    } catch (err) {
      logger.error('Failed to write audit log:', err);
    }
  }

  /**
   * Query audit logs with pagination and filters
   */
  async queryLogs(filters: {
    limit?: number;
    offset?: number;
    action?: string;
    riskLevel?: string;
    status?: string;
    search?: string;
  }) {
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    const params: any[] = [];
    let whereClauses: string[] = ['1=1'];

    if (filters.action && filters.action !== 'ALL') {
      params.push(filters.action);
      whereClauses.push(`action = $${params.length}`);
    }

    if (filters.riskLevel && filters.riskLevel !== 'ALL') {
      params.push(filters.riskLevel);
      whereClauses.push(`risk_level = $${params.length}`);
    }

    if (filters.status && filters.status !== 'ALL') {
      params.push(filters.status);
      whereClauses.push(`status = $${params.length}`);
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      whereClauses.push(
        `(user_email ILIKE $${params.length} OR action ILIKE $${params.length} OR ip_address ILIKE $${params.length} OR entity_type ILIKE $${params.length})`
      );
    }

    const whereSql = whereClauses.join(' AND ');

    // Get total count
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM audit_logs WHERE ${whereSql}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    // Get paginated rows
    params.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT id, user_id, user_email, action, entity_type, entity_id,
              old_values, new_values, ip_address, user_agent, status, risk_level, created_at
       FROM audit_logs
       WHERE ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      total,
      limit,
      offset,
      logs: dataRes.rows
    };
  }

  /**
   * Get audit metrics and threat statistics
   */
  async getStats() {
    const totalRes = await pool.query('SELECT COUNT(*) FROM audit_logs');
    const failed24hRes = await pool.query(
      `SELECT COUNT(*) FROM audit_logs 
       WHERE (action = 'LOGIN_FAILED' OR status = 'FAILURE') 
       AND created_at >= NOW() - INTERVAL '24 hours'`
    );
    const highRiskRes = await pool.query(
      `SELECT COUNT(*) FROM audit_logs 
       WHERE risk_level IN ('HIGH', 'CRITICAL')`
    );
    const activeSessionsRes = await pool.query(
      `SELECT COUNT(*) FROM user_sessions WHERE is_revoked = false`
    );

    return {
      totalEvents: parseInt(totalRes.rows[0].count, 10),
      failedLogins24h: parseInt(failed24hRes.rows[0].count, 10),
      highRiskThreats: parseInt(highRiskRes.rows[0].count, 10),
      activeSessions: parseInt(activeSessionsRes.rows[0].count, 10)
    };
  }

  /**
   * Export audit logs to CSV
   */
  async exportCsv(): Promise<string> {
    const res = await pool.query(
      `SELECT id, created_at, action, user_email, ip_address, user_agent, status, risk_level, entity_type
       FROM audit_logs
       ORDER BY created_at DESC
       LIMIT 5000`
    );

    const headers = ['ID', 'Timestamp', 'Action', 'User Email', 'IP Address', 'Device / Agent', 'Status', 'Risk Level', 'Entity'];
    const rows = res.rows.map(r => [
      `"${r.id}"`,
      `"${new Date(r.created_at).toISOString()}"`,
      `"${r.action}"`,
      `"${r.user_email || 'N/A'}"`,
      `"${r.ip_address || 'N/A'}"`,
      `"${(r.user_agent || '').replace(/"/g, '""')}"`,
      `"${r.status}"`,
      `"${r.risk_level}"`,
      `"${r.entity_type}"`
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

export default new AuditService();

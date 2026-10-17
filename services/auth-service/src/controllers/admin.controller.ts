import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../database/connection';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/admin.middleware';
import auditService from '../services/audit.service';

export class AdminController {
  /**
   * Get all users
   */
  async getAllUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const search = req.query.search as string || '';

      const query = search
        ? `SELECT id, email, first_name, last_name, role, is_banned, created_at, last_login
           FROM users 
           WHERE email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`
        : `SELECT id, email, first_name, last_name, role, is_banned, created_at, last_login
           FROM users 
           ORDER BY created_at DESC
           LIMIT $1 OFFSET $2`;

      const params = search 
        ? [`%${search}%`, limit, offset]
        : [limit, offset];

      const result = await pool.query(query, params);
      const countResult = await pool.query('SELECT COUNT(*) FROM users');

      res.json({
        success: true,
        data: {
          users: result.rows,
          total: parseInt(countResult.rows[0].count),
          limit,
          offset
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single user details
   */
  async getUserById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;

      const result = await pool.query(
        `SELECT id, email, first_name, last_name, country, role, is_banned, created_at, updated_at, last_login
         FROM users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('User not found', 404);
      }

      res.json({
        success: true,
        data: {
          user: result.rows[0]
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Ban/Unban user
   */
  async banUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { is_banned } = req.body;

      // Prevent banning self
      if (userId === req.user?.user_id) {
        throw new AppError('Cannot ban yourself', 400);
      }

      const result = await pool.query(
        `UPDATE users SET is_banned = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, email, is_banned`,
        [is_banned, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('User not found', 404);
      }

      logger.info(`User ${req.user?.email} ${is_banned ? 'banned' : 'unbanned'} user ${result.rows[0].email}`);

      res.json({
        success: true,
        message: `User ${is_banned ? 'banned' : 'unbanned'} successfully`,
        data: {
          user: result.rows[0]
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete user
   */
  async deleteUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;

      // Prevent deleting self
      if (userId === req.user?.user_id) {
        throw new AppError('Cannot delete yourself', 400);
      }

      const result = await pool.query(
        `DELETE FROM users WHERE id = $1 RETURNING id, email`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('User not found', 404);
      }

      logger.info(`User ${req.user?.email} deleted user ${result.rows[0].email}`);

      res.json({
        success: true,
        message: 'User deleted successfully',
        data: {
          user: result.rows[0]
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change user role
   */
  async changeUserRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!['user', 'admin', 'moderator'].includes(role)) {
        throw new AppError('Invalid role', 400);
      }

      // Prevent downgrading self from admin
      if (userId === req.user?.user_id && role !== 'admin') {
        throw new AppError('Cannot downgrade yourself from admin', 400);
      }

      const result = await pool.query(
        `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, email, role`,
        [role, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('User not found', 404);
      }

      logger.info(`User ${req.user?.email} changed role of ${result.rows[0].email} to ${role}`);

      res.json({
        success: true,
        message: 'User role updated successfully',
        data: {
          user: result.rows[0]
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get admin statistics
   */
  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const totalUsersResult = await pool.query('SELECT COUNT(*) FROM users');
      const bannedUsersResult = await pool.query('SELECT COUNT(*) FROM users WHERE is_banned = true');
      const adminUsersResult = await pool.query('SELECT COUNT(*) FROM users WHERE role = \'admin\'');
      const recentUsersResult = await pool.query(
        'SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL \'7 days\''
      );

      res.json({
        success: true,
        data: {
          stats: {
            total_users: parseInt(totalUsersResult.rows[0].count),
            banned_users: parseInt(bannedUsersResult.rows[0].count),
            admin_users: parseInt(adminUsersResult.rows[0].count),
            new_users_week: parseInt(recentUsersResult.rows[0].count)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create new user (admin only)
   */
  async createUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email, password, first_name, last_name, country, role = 'user' } = req.body;

      // Validate required fields
      if (!email || !password || !first_name || !last_name) {
        throw new AppError('Missing required fields', 400);
      }

      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        throw new AppError('Email already registered', 400);
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();

      // Create user
      const result = await pool.query(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, country, role, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, email, first_name, last_name, role`,
        [userId, email, hashedPassword, first_name, last_name, country || 'US', role, 'active']
      );

      logger.info(`Admin ${req.user?.email} created user ${email}`);

      res.json({
        success: true,
        message: 'User created successfully',
        data: {
          user: result.rows[0]
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reset user password (admin only)
   */
  async resetUserPassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        throw new AppError('Password must be at least 6 characters', 400);
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      const result = await pool.query(
        `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, email, first_name, last_name`,
        [hashedPassword, userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('User not found', 404);
      }

      logger.info(`Admin ${req.user?.email} reset password for user ${result.rows[0].email}`);

      res.json({
        success: true,
        message: 'Password reset successfully',
        data: {
          user: result.rows[0]
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get audit logs with filters (admin only)
   */
  async getAuditLogs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const limit = parseInt((req as any).query?.limit as string) || 20;
      const offset = parseInt((req as any).query?.offset as string) || 0;
      const action = (req as any).query?.action as string;
      const riskLevel = (req as any).query?.riskLevel as string;
      const status = (req as any).query?.status as string;
      const search = (req as any).query?.search as string;

      const result = await auditService.queryLogs({
        limit,
        offset,
        action,
        riskLevel,
        status,
        search
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get audit statistics (admin only)
   */
  async getAuditStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await auditService.getStats();
      res.json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export audit logs to CSV (admin only)
   */
  async exportAuditLogs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const csv = await auditService.exportCsv();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=security-audit-logs-${Date.now()}.csv`);
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  }
}

export default AdminController;

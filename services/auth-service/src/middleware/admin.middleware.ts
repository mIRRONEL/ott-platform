import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../database/connection';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    user_id: string;
    email: string;
    role?: string;
  };
}

/**
 * Verify JWT token and extract user info
 */
export async function verifyAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      throw new AppError('Missing authorization token', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
    req.user = {
      user_id: decoded.user_id,
      email: decoded.email
    };

    // Fetch user role from database
    const result = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [decoded.user_id]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    req.user.role = result.rows[0].role;
    next();
  } catch (error: any) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    res.status(401).json({ success: false, message: 'Unauthorized' });
  }
}

/**
 * Require admin role
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden - Admin access required' });
  }

  next();
}

export default { verifyAuth, requireAdmin };

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../database/connection';
import { producer } from '../kafka/producer';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import redisService from '../config/redis';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    logger.info(`Login attempt for email: ${email}`);

    // Find user - This is where "The client is closed" error comes from
    const result = await pool.query(
      'SELECT id, email, password_hash, status FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid email or password', 401);
    }

    const user = result.rows[0];

    // Check status
    if (user.status !== 'active') {
      throw new AppError('User account is not active', 403);
    }

    // Verify password
    const isValidPassword = bcrypt.compareSync(password, user.password_hash);

    if (!isValidPassword) {
      throw new AppError('Invalid email or password', 401);
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { user_id: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { user_id: user.id },
      process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      { expiresIn: '7d' }
    );

    logger.info(`User logged in: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 3600
      }
    });
  } catch (error) {
    logger.error(`Login error:`, error);
    next(error);
  }
}

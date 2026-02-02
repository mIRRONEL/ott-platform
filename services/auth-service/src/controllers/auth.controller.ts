import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../database/connection';
import { Client } from 'pg';
import { producer } from '../kafka/producer';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import redisService from '../config/redis';

export class AuthController {
  /**
   * Register new user
   */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, first_name, last_name, country } = req.body;

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
        `INSERT INTO users (id, email, password_hash, first_name, last_name, country)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, first_name, last_name`,
        [userId, email, hashedPassword, first_name, last_name, country]
      );

      const user = result.rows[0];

      // Publish user.registered event to Kafka
      await producer.send({
        topic: 'user.registered',
        messages: [
          {
            key: userId,
            value: JSON.stringify({
              event_id: uuidv4(),
              event_type: 'user.registered',
              timestamp: new Date().toISOString(),
              user_id: userId,
              email: user.email,
              first_name: user.first_name,
              last_name: user.last_name,
              country: country || null,
              signup_source: 'web'
            })
          }
        ]
      });

      logger.info(`New user registered: ${email}`);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user_id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user - WORKING VERSION
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      logger.info(`Login attempt for: ${email}`);

      // Use simple SELECT that works (same as register does)
      const userResult = await pool.query(
        `SELECT id, email, password_hash, status FROM users WHERE email = $1 LIMIT 1`,
        [email]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const user = userResult.rows[0];

      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Account is inactive'
        });
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Generate tokens
      const accessToken = jwt.sign(
        { user_id: user.id, email: user.email },
        process.env.JWT_SECRET || 'your_jwt_secret_here',
        { expiresIn: '1h' }
      );

      const refreshToken = jwt.sign(
        { user_id: user.id },
        process.env.JWT_REFRESH_SECRET || 'refresh-secret',
        { expiresIn: '7d' }
      );

      logger.info(`User logged in: ${email}`);

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 3600
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      return res.status(500).json({
        success: false,
        message: 'Login failed'
      });
    }
  }

  /**
   * Refresh token
   */
  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        throw new AppError('Refresh token required', 400);
      }

      // Verify refresh token
      const decoded: any = jwt.verify(
        refresh_token,
        process.env.JWT_REFRESH_SECRET || 'refresh-secret'
      );

      // Generate new access token
      const accessToken = jwt.sign(
        { user_id: decoded.user_id },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '1h' }
      );

      res.json({
        success: true,
        data: {
          access_token: accessToken,
          expires_in: 3600
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user
   */
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;

      if (authHeader && redisService.isConnected()) {
        const token = authHeader.split(' ')[1];
        const decoded: any = jwt.decode(token);

        if (decoded) {
          try {
            const redisClient = redisService.getClient();
            if (redisClient) {
              // Add token to blacklist
              const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

              if (expiresIn > 0) {
                await redisClient.set(`token:blacklist:${token}`, '1', { EX: expiresIn });
              }

              // Remove refresh token
              await redisClient.del(`refresh_token:${decoded.user_id}`);
            }
          } catch (redisError) {
            logger.warn(`Redis logout operations failed: ${redisError}`);
          }
        }
      }

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, message: 'Email verified' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Forgot password
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;

      // Check if user exists
      const result = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          message: 'If email exists, a password reset link will be sent'
        });
      }

      // Generate reset token
      const resetToken = jwt.sign(
        { user_id: result.rows[0].id, type: 'password_reset' },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '1h' }
      );

      // TODO: Send email with reset link

      logger.info(`Password reset requested for: ${email}`);

      res.json({
        success: true,
        message: 'Password reset link sent to email'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reset password
   */
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      const { password } = req.body;

      // Verify token
      const decoded: any = jwt.verify(
        token,
        process.env.JWT_SECRET || 'secret'
      );

      if (decoded.type !== 'password_reset') {
        throw new AppError('Invalid reset token', 400);
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update password
      await pool.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [hashedPassword, decoded.user_id]
      );

      logger.info(`Password reset successful for user: ${decoded.user_id}`);

      res.json({
        success: true,
        message: 'Password updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate JWT token
   */
  async validateToken(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        throw new AppError('No authorization header', 401);
      }

      const token = authHeader.split(' ')[1];

      // Check if token is blacklisted (if Redis is available)
      if (redisService.isConnected()) {
        try {
          const redisClient = redisService.getClient();
          if (redisClient) {
            const isBlacklisted = await redisClient.get(`token:blacklist:${token}`);
            if (isBlacklisted) {
              throw new AppError('Token has been revoked', 401);
            }
          }
        } catch (redisError: any) {
          if (redisError.message?.includes('revoked')) {
            throw redisError;
          }
          logger.warn(`Redis blacklist check failed: ${redisError}`);
        }
      }

      // Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'secret'
      );

      res.json({
        success: true,
        data: decoded
      });
    } catch (error) {
      next(error);
    }
  }
}

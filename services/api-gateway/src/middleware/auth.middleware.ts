import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { redisClient } from '../config/redis';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
        jti?: string;
      };
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req);

    if (!token) {
      // Some endpoints allow public access, let the service decide
      return next();
    }

    const jwtSecret = process.env.JWT_SECRET || 'PnuI0vPoM80lH3NYnWWi/AU6MYEZSY5OYrSke2BeNJU';
    const decoded = jwt.verify(token, jwtSecret) as any;

    // Check Redis blacklist if token has a jti
    if (decoded.jti) {
      try {
        const isRevoked = await redisClient.get(`blacklist:${decoded.jti}`);
        if (isRevoked) {
          logger.warn(`[Auth Guard] Rejected revoked JWT with JTI: ${decoded.jti}`);
          return res.status(401).json({
            status: 'error',
            message: 'Session has been revoked or logged out remotely. Please sign in again.',
            statusCode: 401,
            code: 'TOKEN_REVOKED'
          });
        }
      } catch (err) {
        logger.warn('[Auth Guard] Redis blacklist check warning:', err);
      }
    }

    req.user = {
      userId: decoded.user_id || decoded.userId || decoded.sub,
      email: decoded.email,
      role: decoded.role || 'user',
      jti: decoded.jti
    };

    logger.info(`Authenticated user: ${req.user.userId}`);
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Token expired');
      return res.status(401).json({
        status: 'error',
        message: 'Token expired',
        statusCode: 401
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid token:', error.message);
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token',
        statusCode: 401
      });
    }

    logger.error('Auth middleware error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      statusCode: 500
    });
  }
};

export const optionalAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return next();
    }

    const jwtSecret = process.env.JWT_SECRET || 'PnuI0vPoM80lH3NYnWWi/AU6MYEZSY5OYrSke2BeNJU';
    const decoded = jwt.verify(token, jwtSecret) as any;

    req.user = {
      userId: decoded.user_id || decoded.userId || decoded.sub,
      email: decoded.email,
      role: decoded.role || 'user'
    };

    logger.info(`Authenticated user (optional): ${req.user.userId}`);
  } catch (error) {
    logger.warn('Optional auth token invalid/expired, continuing as guest');
  }
  next();
};

export const adminOnlyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Allow internal service secret bypass
  const internalSecret = req.headers['x-internal-service-secret'];
  if (internalSecret && internalSecret === process.env.INTERNAL_SERVICE_SECRET) {
    return next();
  }

  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Authentication required for system administration access'
    });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'PnuI0vPoM80lH3NYnWWi/AU6MYEZSY5OYrSke2BeNJU';
    const decoded = jwt.verify(token, jwtSecret) as any;
    req.user = {
      userId: decoded.user_id || decoded.userId || decoded.sub,
      email: decoded.email,
      role: decoded.role || 'user'
    };

    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN',
        message: 'Forbidden: System administration access required'
      });
    }

    next();
  } catch (error: any) {
    return res.status(401).json({
      status: 'error',
      code: 'INVALID_TOKEN',
      message: 'Invalid or expired authentication token'
    });
  }
};

const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

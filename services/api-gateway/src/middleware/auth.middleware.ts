import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req);

    if (!token) {
      // Some endpoints allow public access, let the service decide
      return next();
    }

    const jwtSecret = process.env.JWT_SECRET || 'your_jwt_secret_here';
    const decoded = jwt.verify(token, jwtSecret) as any;

    req.user = {
      userId: decoded.user_id || decoded.userId || decoded.sub,
      email: decoded.email,
      role: decoded.role || 'user'
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

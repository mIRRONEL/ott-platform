import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = generateRequestId();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);

  // Log incoming request
  logger.info(`[${requestId}] Incoming request`, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.userId || 'anonymous'
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;

    // Log outgoing response
    logger.info(`[${requestId}] Outgoing response`, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.userId || 'anonymous'
    });

    // Call original send
    return originalSend.call(this, data);
  };

  next();
};

const generateRequestId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    logger.error(`[${err.statusCode}] ${err.message}`, { url: req.url });
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      statusCode: err.statusCode
    });
  }

  logger.error('Unexpected error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    statusCode: 500
  });
};

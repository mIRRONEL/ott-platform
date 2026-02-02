import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    logger.error(`${err.code}: ${err.message}`, {
      path: req.path,
      method: req.method,
      statusCode: err.statusCode
    });

    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      code: err.code
    });
  }

  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack
  });

  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    code: 'INTERNAL_SERVER_ERROR'
  });
};

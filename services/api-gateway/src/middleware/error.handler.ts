import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, message);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(serviceName: string) {
    super(503, `Service ${serviceName} is unavailable`);
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

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

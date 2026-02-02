import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

export const validateRequest = (schema: Schema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[source];
      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const errorMessages = error.details.map(detail => detail.message).join(', ');
        throw new ValidationError(errorMessages);
      }

      if (source === 'body') req.body = value;
      if (source === 'query') req.query = value;
      if (source === 'params') req.params = value;

      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          status: 'error',
          message: error.message,
          statusCode: 400
        });
      }
      next(error);
    }
  };
};

import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';

export const validateRequest = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const { error, value } = (schema.body || schema).validate(req.body || req.query, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const messages = error.details.map(detail => detail.message).join(', ');
        throw new ValidationError(messages);
      }

      if (schema.body) {
        req.body = value;
      } else {
        req.query = value as any;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};

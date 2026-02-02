import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../utils/errors';

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const message = error.details
          .map((detail) => detail.message)
          .join(', ');
        throw new ValidationError(message);
      }

      req.body = value;
      next();
    } catch (err) {
      next(err);
    }
  };
};

import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { ValidationError } from '../utils/errors';

export const validateRequest = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!schema) return next();

      if (schema.body) {
        const { error, value } = schema.body.validate(req.body, {
          abortEarly: false,
          stripUnknown: true
        });
        if (error) {
          const messages = error.details.map((d: any) => d.message).join(', ');
          throw new ValidationError(messages);
        }
        req.body = value;
        return next();
      }

      if (schema.query) {
        const { error, value } = schema.query.validate(req.query, {
          abortEarly: false,
          stripUnknown: true
        });
        if (error) {
          const messages = error.details.map((d: any) => d.message).join(', ');
          throw new ValidationError(messages);
        }
        req.query = value;
        return next();
      }

      if (schema.params) {
        const { error, value } = schema.params.validate(req.params, {
          abortEarly: false,
          stripUnknown: true
        });
        if (error) {
          const messages = error.details.map((d: any) => d.message).join(', ');
          throw new ValidationError(messages);
        }
        req.params = value;
        return next();
      }

      if (typeof schema.validate === 'function') {
        const { error, value } = schema.validate(req.body, {
          abortEarly: false,
          stripUnknown: true
        });
        if (error) {
          const messages = error.details.map((d: any) => d.message).join(', ');
          throw new ValidationError(messages);
        }
        req.body = value;
        return next();
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

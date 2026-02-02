import { Request, Response, NextFunction } from 'express';
import { Schema, ValidationError as JoiValidationError } from 'joi';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

export const validateRequest = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const toValidate = {
        body: req.body,
        params: req.params,
        query: req.query
      };

      const { error, value } = (schema.body || schema).validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const messages = error.details.map(detail => detail.message).join(', ');
        throw new ValidationError(messages);
      }

      req.body = value;
      next();
    } catch (err) {
      next(err);
    }
  };
};

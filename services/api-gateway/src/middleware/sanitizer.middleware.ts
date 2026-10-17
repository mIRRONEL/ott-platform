import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Deep recursive sanitizer for NoSQL Injection vectors (strips '$' prefix & MongoDB operators)
 */
function sanitizeNoSql(payload: any): any {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map(item => sanitizeNoSql(item));
  }

  const cleanObj: Record<string, any> = {};

  for (const key of Object.keys(payload)) {
    // Strip keys starting with '$' or containing dots
    if (key.startsWith('$') || key.includes('.')) {
      logger.warn(`[OWASP Shield] NoSQL injection key stripped: ${key}`);
      continue;
    }

    const value = payload[key];

    // If value is an object with operator keys like { "$gt": "" }, neutralize it
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const hasOperators = Object.keys(value).some(k => k.startsWith('$'));
      if (hasOperators) {
        logger.warn(`[OWASP Shield] NoSQL operator object neutralized for key: ${key}`);
        cleanObj[key] = String(Object.values(value)[0] || '');
        continue;
      }
    }

    cleanObj[key] = sanitizeNoSql(value);
  }

  return cleanObj;
}

/**
 * XSS string sanitizer
 */
function sanitizeXss(payload: any): any {
  if (typeof payload === 'string') {
    // Strip script tags and dangerous event handlers while preserving standard text & characters
    return payload
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, 'sanitized_attr=');
  }

  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload)) {
      return payload.map(item => sanitizeXss(item));
    }
    const clean: Record<string, any> = {};
    for (const key of Object.keys(payload)) {
      clean[key] = sanitizeXss(payload[key]);
    }
    return clean;
  }

  return payload;
}

/**
 * OWASP Top 10 Request Sanitizer Middleware
 */
export const owaspSanitizerMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Skip video upload binary bodies / streams
    if (req.is('multipart/form-data') || req.path.includes('/upload') || req.path.includes('/stream/')) {
      return next();
    }

    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeNoSql(req.body);
      req.body = sanitizeXss(req.body);
    }

    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeNoSql(req.query);
      req.query = sanitizeXss(req.query);
    }

    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeNoSql(req.params);
      req.params = sanitizeXss(req.params);
    }

    next();
  } catch (error) {
    logger.error('[OWASP Shield] Sanitizer error:', error);
    next();
  }
};

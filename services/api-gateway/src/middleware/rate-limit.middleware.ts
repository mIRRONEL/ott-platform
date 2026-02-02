import rateLimit from 'express-rate-limit';

// General API rate limit - 1000 requests per 15 minutes per IP (very permissive for development)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID from JWT if available, otherwise use IP
    return (req as any).userId || req.ip || '';
  },
  skip: (req) => {
    // Don't rate limit health checks
    if (req.path === '/health' || req.path === '/status') return true;
    // Don't rate limit HLS streaming (needs many rapid requests) - THIS IS CRITICAL
    if (req.path.includes('/hls/')) return true;
    if (req.path.includes('segment_')) return true;
    if (req.path.includes('.ts')) return true;
    // Don't rate limit upload progress checks (polled frequently)
    if (req.path.includes('/progress')) return true;
    // Don't rate limit video uploads
    if (req.path.includes('/upload')) return true;
    // Don't rate limit content retrieval
    if (req.path.match(/\/videos\/[^/]+\/(hls|stream)/)) return true;
    return false;
  }
});

// Streaming rate limit - Higher limit for streaming
export const streamingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many streaming requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Auth rate limit - Stricter limit for auth endpoints (prevent brute force)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Don't rate limit GET requests (like token validation)
    return req.method === 'GET';
  }
});

// Payment rate limit - Moderate limit for payment endpoints
export const paymentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 10,
  message: 'Too many payment requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

export const rateLimitMiddleware = {
  api: apiLimiter,
  streaming: streamingLimiter,
  auth: authLimiter,
  payment: paymentLimiter
};

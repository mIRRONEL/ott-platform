import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

// Master secrets (can be overridden via environment variables)
const STREAM_SIGNING_SECRET = process.env.STREAM_SIGNING_SECRET || 'ott_super_secure_stream_signing_secret_2026';
const STREAM_DRM_MASTER_KEY = process.env.STREAM_DRM_MASTER_KEY || 'ott_aes_128_drm_master_key_secret_2026';
const DEFAULT_TOKEN_TTL_SECONDS = 4 * 60 * 60; // 4 Hours

export interface StreamTokenPayload {
  v: string;      // videoId
  u?: string;     // userId
  exp: number;    // Expiration timestamp in seconds
  n: string;      // Unique cryptographic nonce
  ip?: string;    // Client IP
}

/**
 * Generate HMAC-SHA256 signed playback token for a video
 */
export function generateStreamToken(options: {
  videoId: string;
  userId?: string;
  expiresInSeconds?: number;
  ip?: string;
}): { token: string; expiresAt: number } {
  const { videoId, userId, expiresInSeconds = DEFAULT_TOKEN_TTL_SECONDS, ip } = options;
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const nonce = crypto.randomBytes(8).toString('hex');

  const payload: StreamTokenPayload = {
    v: videoId,
    u: userId || 'anonymous',
    exp: expiresAt,
    n: nonce,
    ...(ip ? { ip } : {})
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', STREAM_SIGNING_SECRET)
    .update(payloadB64)
    .digest('base64url');

  const token = `${payloadB64}.${signature}`;
  return { token, expiresAt };
}

/**
 * Verify HMAC-SHA256 stream token
 */
export function verifyStreamToken(
  tokenString: string | undefined | null,
  expectedVideoId?: string
): { valid: boolean; error?: string; payload?: StreamTokenPayload } {
  if (!tokenString) {
    return { valid: false, error: 'Stream token is required for playback' };
  }

  const parts = tokenString.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed stream token format' };
  }

  const [payloadB64, signatureB64] = parts;

  // 1. Verify HMAC-SHA256 signature
  const expectedSignature = crypto
    .createHmac('sha256', STREAM_SIGNING_SECRET)
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(signatureB64);
  const expSigBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expSigBuf.length || !crypto.timingSafeEqual(sigBuf, expSigBuf)) {
    return { valid: false, error: 'Invalid stream token cryptographic signature' };
  }

  // 2. Decode payload
  let payload: StreamTokenPayload;
  try {
    const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    payload = JSON.parse(jsonStr);
  } catch (err) {
    return { valid: false, error: 'Invalid token payload serialization' };
  }

  // 3. Verify expiration
  const currentSec = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < currentSec) {
    return { valid: false, error: `Stream token expired ${currentSec - payload.exp}s ago` };
  }

  // 4. Verify videoId match (if specified)
  if (expectedVideoId && payload.v !== expectedVideoId) {
    return { valid: false, error: `Token video ID mismatch: expected ${expectedVideoId}, got ${payload.v}` };
  }

  return { valid: true, payload };
}

/**
 * Derive deterministic 16-byte (128-bit) AES encryption key for a video
 */
export function getVideoDrmKey(videoId: string): Buffer {
  return crypto
    .createHmac('sha256', STREAM_DRM_MASTER_KEY)
    .update(`drm-key-${videoId}`)
    .digest()
    .subarray(0, 16); // 16 bytes = 128 bits
}

/**
 * Derive deterministic 16-byte IV for video profile
 */
export function getVideoQualityIV(videoId: string, quality: string): { ivBuffer: Buffer; ivHex: string } {
  const ivHex = crypto
    .createHash('md5')
    .update(`drm-iv-${videoId}-${quality}`)
    .digest('hex'); // Exactly 32 hex chars = 16 bytes
  const ivBuffer = Buffer.from(ivHex, 'hex');
  return { ivBuffer, ivHex };
}

/**
 * Dynamically encrypt video segment with AES-128-CBC
 */
export function encryptSegmentAES128(plainBuffer: Buffer, key: Buffer, iv: Buffer): Buffer {
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  return Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
}

/**
 * Express middleware to enforce stream token verification
 */
export function enforceStreamToken(req: Request, res: Response, next: NextFunction): void {
  const videoId = req.params.videoId || req.body?.videoId || req.query?.videoId;
  const token = (req.query.token as string) || 
                (req.headers['x-stream-token'] as string) ||
                (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);

  // Check token
  const result = verifyStreamToken(token, videoId as string);
  if (!result.valid) {
    logger.warn(`[DRM] Access denied for video ${videoId}: ${result.error}`);
    res.status(403).json({
      status: 'error',
      code: 'DRM_TOKEN_INVALID',
      message: result.error || 'Access denied. Valid stream token required.',
      details: { videoId }
    });
    return;
  }

  // Attach verified payload
  (req as any).streamToken = result.payload;
  next();
}

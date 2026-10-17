import { Router } from 'express';
import {
  getStreamManifest,
  getQualityPlaylist,
  getVideoSegment,
  getVideoThumbnail,
  getPlaybackStatus,
  updatePlaybackPosition,
  startStream,
  endStream,
  getStreamQuality,
  reportStreamError,
  logWatchProgress,
  getContinueWatching,
  deleteWatchProgress,
  generatePlaybackToken,
  getDrmKey,
  heartbeatStreamSession,
  stopStreamSession,
  getActiveStreamingScreens
} from '../controllers/streaming.controller';
import { validateRequest } from '../middleware/validation';
import {
  playbackSchema,
  segmentSchema,
  streamSchema,
  qualitySchema
} from '../schemas/streaming.schema';

const router = Router();

/**
 * @route POST /api/stream/token
 * @route GET /api/stream/token
 * @route GET /api/stream/:videoId/token
 * @description Generate HMAC-SHA256 Signed Playback Token & DRM metadata
 * @access Public / Authenticated
 */
router.post('/token', generatePlaybackToken);
router.get('/token', generatePlaybackToken);
router.get('/:videoId/token', generatePlaybackToken);

/**
 * @route GET /api/stream/:videoId/drm/key
 * @route GET /api/stream/:videoId/key
 * @description Deliver binary 16-byte AES-128 key for dynamic DRM playback
 * @access Token Enforced
 */
router.get('/:videoId/drm/key', getDrmKey);
router.get('/:videoId/key', getDrmKey);

/**
 * @route GET /api/stream/continue-watching
 * @description Get user's Continue Watching shelf
 * @access Public / Private
 */
router.get('/continue-watching', getContinueWatching);

/**
 * @route DELETE /api/stream/:videoId/progress
 * @description Remove a video from Continue Watching shelf
 * @access Public / Private
 */
router.delete('/:videoId/progress', deleteWatchProgress);

/**
 * @route POST /api/stream/watch-progress
 * @description Log watch progress and continue watching position
 * @access Public / Private
 */
router.post('/watch-progress', logWatchProgress);

/**
 * @route POST /api/stream/start
 * @description Start streaming session
 * @access Private
 */
router.post('/start', validateRequest(streamSchema), startStream);

/**
 * @route GET /api/stream/:videoId/manifest
 * @description Get HLS/DASH manifest (Protected by Signed Token)
 * @access Public / Token Enforced
 */
router.get('/:videoId/manifest', getStreamManifest);

/**
 * @route GET /api/stream/:videoId/playlist/:quality
 * @description Get quality-specific HLS playlist
 * @access Public
 */
router.get('/:videoId/playlist/:quality', getQualityPlaylist);

/**
 * @route GET /api/stream/:videoId/segment/:segmentId
 * @description Get video segment
 * @access Public
 */
router.get('/:videoId/segment/:segmentId', getVideoSegment);

/**
 * @route GET /api/stream/:videoId/thumbnail
 * @description Get video thumbnail
 * @access Public
 */
router.get('/:videoId/thumbnail', getVideoThumbnail);

/**
 * @route GET /api/stream/playback/:sessionId
 * @description Get playback status
 * @access Private
 */
router.get('/playback/:sessionId', getPlaybackStatus);

/**
 * @route PUT /api/stream/playback/:sessionId
 * @description Update playback position
 * @access Private
 */
router.put('/playback/:sessionId', validateRequest(playbackSchema), updatePlaybackPosition);

/**
 * @route POST /api/stream/:sessionId/end
 * @description End streaming session
 * @access Private
 */
router.post('/:sessionId/end', endStream);

/**
 * @route GET /api/stream/:videoId/quality
 * @description Get available quality options
 * @access Public
 */
router.get('/:videoId/quality', getStreamQuality);

/**
 * @route POST /api/stream/sessions/:sessionId/heartbeat
 * @description Maintain active playback stream heartbeat
 */
router.post('/sessions/:sessionId/heartbeat', heartbeatStreamSession);

/**
 * @route POST /api/stream/sessions/:sessionId/stop
 * @description Unregister active playback stream
 */
router.post('/sessions/:sessionId/stop', stopStreamSession);

/**
 * @route GET /api/stream/sessions/active
 * @description Get active concurrent playback streams for current user
 */
router.get('/sessions/active', getActiveStreamingScreens);

export default router;

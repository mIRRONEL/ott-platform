import { Router } from 'express';
import {
  getStreamManifest,
  getVideoSegment,
  getPlaybackStatus,
  updatePlaybackPosition,
  startStream,
  endStream,
  getStreamQuality,
  reportStreamError
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
 * @route POST /api/stream/start
 * @description Start streaming session
 * @access Private
 */
router.post('/start', validateRequest(streamSchema), startStream);

/**
 * @route GET /api/stream/:videoId/manifest
 * @description Get HLS/DASH manifest
 * @access Public
 */
router.get('/:videoId/manifest', getStreamManifest);

/**
 * @route GET /api/stream/:videoId/segment/:segmentId
 * @description Get video segment
 * @access Public
 */
router.get('/:videoId/segment/:segmentId', getVideoSegment);

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
 * @route POST /api/stream/error
 * @description Report streaming error
 * @access Private
 */
router.post('/error', validateRequest(streamSchema), reportStreamError);

export default router;

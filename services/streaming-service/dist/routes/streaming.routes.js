"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const streaming_controller_1 = require("../controllers/streaming.controller");
const validation_1 = require("../middleware/validation");
const streaming_schema_1 = require("../schemas/streaming.schema");
const router = (0, express_1.Router)();
/**
 * @route POST /api/stream/start
 * @description Start streaming session
 * @access Private
 */
router.post('/start', (0, validation_1.validateRequest)(streaming_schema_1.streamSchema), streaming_controller_1.startStream);
/**
 * @route GET /api/stream/:videoId/manifest
 * @description Get HLS/DASH manifest
 * @access Public
 */
router.get('/:videoId/manifest', streaming_controller_1.getStreamManifest);
/**
 * @route GET /api/stream/:videoId/segment/:segmentId
 * @description Get video segment
 * @access Public
 */
router.get('/:videoId/segment/:segmentId', streaming_controller_1.getVideoSegment);
/**
 * @route GET /api/stream/playback/:sessionId
 * @description Get playback status
 * @access Private
 */
router.get('/playback/:sessionId', streaming_controller_1.getPlaybackStatus);
/**
 * @route PUT /api/stream/playback/:sessionId
 * @description Update playback position
 * @access Private
 */
router.put('/playback/:sessionId', (0, validation_1.validateRequest)(streaming_schema_1.playbackSchema), streaming_controller_1.updatePlaybackPosition);
/**
 * @route POST /api/stream/:sessionId/end
 * @description End streaming session
 * @access Private
 */
router.post('/:sessionId/end', streaming_controller_1.endStream);
/**
 * @route GET /api/stream/:videoId/quality
 * @description Get available quality options
 * @access Public
 */
router.get('/:videoId/quality', streaming_controller_1.getStreamQuality);
/**
 * @route POST /api/stream/error
 * @description Report streaming error
 * @access Private
 */
router.post('/error', (0, validation_1.validateRequest)(streaming_schema_1.streamSchema), streaming_controller_1.reportStreamError);
exports.default = router;
//# sourceMappingURL=streaming.routes.js.map
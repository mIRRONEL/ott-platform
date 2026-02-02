"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const content_controller_1 = require("../controllers/content.controller");
const validation_1 = require("../middleware/validation");
const multer_1 = __importDefault(require("../config/multer"));
const content_schema_1 = require("../schemas/content.schema");
const router = (0, express_1.Router)();
/**
 * @route POST /api/content/upload
 * @description Upload a video file
 * @access Admin
 */
router.post('/upload', multer_1.default.single('video'), content_controller_1.uploadVideo);
/**
 * @route GET /api/content/videos
 * @description Get all videos with pagination
 * @access Public
 */
router.get('/videos', content_controller_1.getAllVideos);
/**
 * @route POST /api/content/videos
 * @description Create a new video
 * @access Admin
 */
router.post('/videos', (0, validation_1.validateRequest)(content_schema_1.createVideoSchema), content_controller_1.createVideo);
/**
 * @route GET /api/content/videos/:videoId
 * @description Get video details
 * @access Public
 */
router.get('/videos/:videoId', content_controller_1.getVideoById);
/**
 * @route PUT /api/content/videos/:videoId
 * @description Update video metadata
 * @access Admin
 */
router.put('/videos/:videoId', (0, validation_1.validateRequest)(content_schema_1.updateVideoSchema), content_controller_1.updateVideo);
/**
 * @route DELETE /api/content/videos/:videoId
 * @description Delete a video
 * @access Admin
 */
router.delete('/videos/:videoId', content_controller_1.deleteVideo);
/**
 * @route GET /api/content/search
 * @description Search videos
 * @access Public
 */
router.get('/search', (0, validation_1.validateRequest)(content_schema_1.searchSchema), content_controller_1.searchVideos);
/**
 * @route GET /api/content/categories
 * @description Get all categories
 * @access Public
 */
router.get('/categories', content_controller_1.getCategories);
/**
 * @route GET /api/content/trending
 * @description Get trending content
 * @access Public
 */
router.get('/trending', content_controller_1.getTrendingContent);
/**
 * @route GET /api/content/videos/:videoId/ratings
 * @description Get video ratings
 * @access Public
 */
router.get('/videos/:videoId/ratings', content_controller_1.getRatedVideos);
/**
 * @route POST /api/content/videos/:videoId/comments
 * @description Add comment to video
 * @access Private
 */
router.post('/videos/:videoId/comments', (0, validation_1.validateRequest)(content_schema_1.commentSchema), content_controller_1.addComment);
/**
 * @route GET /api/content/videos/:videoId/comments
 * @description Get comments for video
 * @access Public
 */
router.get('/videos/:videoId/comments', content_controller_1.getComments);
/**
 * @route POST /api/content/videos/:videoId/rate
 * @description Rate a video
 * @access Private
 */
router.post('/videos/:videoId/rate', (0, validation_1.validateRequest)(content_schema_1.ratingSchema), content_controller_1.rateVideo);
exports.default = router;
//# sourceMappingURL=content.routes.js.map
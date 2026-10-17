import { Router } from 'express';
import {
  uploadVideo,
  getAllVideos,
  createVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  searchVideos,
  getCategories,
  getTrendingContent,
  getRatedVideos,
  addComment,
  getComments,
  rateVideo,
  getHLSManifest,
  getProcessingProgress,
  initChunkedUpload,
  getChunkedUploadStatus,
  uploadChunk,
  completeChunkedUpload,
  triggerVideoTranscoding,
  deleteRawMasterVideo,
  getStudioSummary
} from '../controllers/content.controller';
import { validateRequest } from '../middleware/validation';
import upload, { chunkUpload } from '../config/multer';
import {
  createVideoSchema,
  updateVideoSchema,
  searchSchema,
  ratingSchema,
  commentSchema
} from '../schemas/content.schema';

const router = Router();

/**
 * Studio Media Manager Summary
 */
router.get('/studio/summary', getStudioSummary);

/**
 * @route POST /api/content/upload
 * @description Upload a monolithic video file (Legacy Fallback)
 * @access Admin
 */
router.post('/upload', upload.single('video'), uploadVideo);

/**
 * Resumable Chunked Multipart / Binary Stream Upload Endpoints
 */
router.post('/upload/init', initChunkedUpload);
router.get('/upload/status/:uploadId', getChunkedUploadStatus);
router.post('/upload/chunk', (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    chunkUpload.single('chunk')(req, res, next);
  } else {
    next();
  }
}, uploadChunk);
router.post('/upload/complete', completeChunkedUpload);

/**
 * @route POST /api/content/videos/:videoId/encode
 * @description Trigger on-demand transcoding for staged or failed raw video
 * @access Admin
 */
router.post('/videos/:videoId/encode', triggerVideoTranscoding);

/**
 * @route DELETE /api/content/videos/:videoId/raw
 * @description Delete raw master file to reclaim disk space (HLS remains playable)
 * @access Admin
 */
router.delete('/videos/:videoId/raw', deleteRawMasterVideo);

/**
 * @route GET /api/content/videos
 * @description Get all videos with pagination
 * @access Public
 */
router.get('/videos', getAllVideos);

/**
 * @route POST /api/content/videos
 * @description Create a new video
 * @access Admin
 */
router.post('/videos', validateRequest(createVideoSchema), createVideo);

/**
 * @route GET /api/content/videos/:videoId
 * @description Get video details
 * @access Public
 */
router.get('/videos/:videoId', getVideoById);

/**
 * @route PUT /api/content/videos/:videoId
 * @description Update video metadata
 * @access Admin
 */
router.put('/videos/:videoId', validateRequest(updateVideoSchema), updateVideo);

/**
 * @route DELETE /api/content/videos/:videoId
 * @description Delete a video
 * @access Admin
 */
router.delete('/videos/:videoId', deleteVideo);

/**
 * @route GET /api/content/search
 * @description Search videos
 * @access Public
 */
router.get('/search', validateRequest(searchSchema), searchVideos);

/**
 * @route GET /api/content/categories
 * @description Get all categories
 * @access Public
 */
router.get('/categories', getCategories);

/**
 * @route GET /api/content/trending
 * @description Get trending content
 * @access Public
 */
router.get('/trending', getTrendingContent);

/**
 * @route GET /api/content/videos/:videoId/ratings
 * @description Get video ratings
 * @access Public
 */
router.get('/videos/:videoId/ratings', getRatedVideos);

/**
 * @route POST /api/content/videos/:videoId/comments
 * @description Add comment to video
 * @access Private
 */
router.post(
  '/videos/:videoId/comments',
  validateRequest(commentSchema),
  addComment
);

/**
 * @route GET /api/content/videos/:videoId/comments
 * @description Get comments for video
 * @access Public
 */
router.get('/videos/:videoId/comments', getComments);

/**
 * @route POST /api/content/videos/:videoId/rate
 * @description Rate a video
 * @access Private
 */
router.post(
  '/videos/:videoId/rate',
  validateRequest(ratingSchema),
  rateVideo
);

/**
 * @route GET /api/content/videos/:videoId/hls
 * @description Get HLS manifest for video streaming
 * @access Public
 */
router.get('/videos/:videoId/hls', getHLSManifest);

/**
 * @route GET /api/content/videos/:videoId/progress
 * @description Get HLS processing progress
 * @access Public
 */
router.get('/videos/:videoId/progress', getProcessingProgress);

/**
 * @route GET /api/content/hls/:videoId/*
 * @description Serve HLS playlist and segment files
 * @access Public
 */
router.get('/hls/:videoId/*', (req, res, next) => {
  try {
    const { videoId } = req.params;
    const filePath = req.params[0]; // Get the wildcard part (e.g., 360p/playlist.m3u8)
    const path = require('path');
    const fs = require('fs');
    
    const hlsDir = process.env.HLS_OUTPUT_DIR || '/tmp/ott-hls';
    const fullPath = path.join(hlsDir, videoId, filePath);
    
    // Security: prevent directory traversal
    const resolvedPath = path.resolve(fullPath);
    const resolvedHlsDir = path.resolve(hlsDir);
    
    if (!resolvedPath.startsWith(resolvedHlsDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.log('[CONTENT] HLS file not found:', fullPath);
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Determine content type
    let contentType = 'application/octet-stream';
    if (filePath.endsWith('.m3u8')) {
      contentType = 'application/vnd.apple.mpegurl';
    } else if (filePath.endsWith('.ts')) {
      contentType = 'video/mp2t';
    }
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(fullPath);
  } catch (error) {
    console.error('[CONTENT] Error serving HLS file:', error);
    next(error);
  }
});

export default router;

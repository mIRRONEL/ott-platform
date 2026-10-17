import express, { Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = express.Router();

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'encoding-service',
    timestamp: new Date().toISOString()
  });
});

// Get encoding status (could connect to database)
router.get('/status/:videoId', (req: Request, res: Response) => {
  const { videoId } = req.params;
  
  // TODO: Check MongoDB for encoding status
  res.status(200).json({
    videoId,
    status: 'in-progress',
    progress: 45,
    message: 'Encoding in progress...'
  });
});

// Manually trigger encoding (debugging)
router.post('/encode', (req: Request, res: Response) => {
  const { videoId, filePath } = req.body;
  
  if (!videoId || !filePath) {
    res.status(400).json({
      error: 'videoId and filePath required'
    });
    return;
  }

  logger.info(`Manual encoding request: ${videoId}`);
  
  res.status(202).json({
    message: 'Encoding job queued',
    videoId,
    filePath
  });
});

export default router;

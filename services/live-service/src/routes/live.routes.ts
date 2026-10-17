import { Router } from 'express';
import {
  getLiveChannels,
  getChannelById,
  getStreamCredentials,
  updateChannelInfo,
  serveLiveStreamFile,
  getLiveChatMessages,
  sendLiveChatMessage,
  startWebcamBroadcast,
  ingestWebcamChunk,
  stopWebcamBroadcast
} from '../controllers/live.controller';

const router = Router();

// Public channels discovery
router.get('/channels', getLiveChannels);
router.get('/channels/:channelId', getChannelById);
router.put('/channels/:channelId', updateChannelInfo);

// Live Chat endpoints
router.get('/chat/:channelId', getLiveChatMessages);
router.post('/chat/:channelId', sendLiveChatMessage);

// In-Browser WebCam Ingest
router.post('/ingest/start/:streamKey', startWebcamBroadcast);
router.post('/ingest/chunk/:streamKey', ingestWebcamChunk);
router.post('/ingest/stop/:streamKey', stopWebcamBroadcast);

// Creator studio RTMP credentials
router.get('/credentials', getStreamCredentials);

// HLS live streaming file delivery
router.get('/:streamKey/:filename', serveLiveStreamFile);

export default router;

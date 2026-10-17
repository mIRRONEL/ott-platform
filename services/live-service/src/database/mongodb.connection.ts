import { MongoClient } from 'mongodb';
import { logger } from '../utils/logger';

const mongoUrl = process.env.MONGODB_URL || 'mongodb://root:IJQWO2DBGY3QU@mongodb:27017/ott_platform?authSource=admin';

export const mongoClient = new MongoClient(mongoUrl, {
  maxPoolSize: 20,
  minPoolSize: 5
});

export const connectMongoDB = async (): Promise<void> => {
  try {
    await mongoClient.connect();
    logger.info('Live Service connected to MongoDB');

    // Create indexes for live channels and sessions
    const db = mongoClient.db('ott_platform');
    await db.collection('live_channels').createIndex({ streamKey: 1 }, { unique: true });
    await db.collection('live_channels').createIndex({ channelId: 1 }, { unique: true });
    await db.collection('live_channels').createIndex({ isLive: 1 });
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
  }
};

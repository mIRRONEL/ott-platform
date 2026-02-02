import { MongoClient, Db } from 'mongodb';
import { logger } from '../utils/logger';

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/analytics_db';
let client: MongoClient;
let db: Db;

export const connectMongoDB = async (): Promise<Db> => {
  try {
    client = new MongoClient(mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 2
    });

    await client.connect();
    db = client.db();

    logger.info('MongoDB connected successfully');

    // Create indexes for performance
    const analyticsCollection = db.collection('analytics_events');
    await analyticsCollection.createIndex({ userId: 1, timestamp: -1 });
    await analyticsCollection.createIndex({ contentId: 1 });
    await analyticsCollection.createIndex({ eventType: 1 });
    await analyticsCollection.createIndex({ timestamp: -1 });

    const userEventsCollection = db.collection('user_events');
    await userEventsCollection.createIndex({ userId: 1 });
    await userEventsCollection.createIndex({ eventType: 1 });
    await userEventsCollection.createIndex({ timestamp: -1 });

    return db;
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    throw error;
  }
};

export const getMongoDb = (): Db => {
  if (!db) {
    throw new Error('MongoDB not connected');
  }
  return db;
};

export const closeMongoDBConnection = async () => {
  try {
    if (client) {
      await client.close();
      logger.info('MongoDB connection closed');
    }
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error);
  }
};

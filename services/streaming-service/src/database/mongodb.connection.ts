import { MongoClient } from 'mongodb';
import { logger } from '../utils/logger';

const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017';

export const mongoClient = new MongoClient(mongoUrl);

mongoClient.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
});

// Connect to MongoDB with retry
const connectMongo = () => {
  mongoClient.connect()
    .then(() => {
      logger.info('MongoDB connected successfully');
    })
    .catch((err) => {
      logger.warn('MongoDB connection failed, will retry in 5s...', err);
      setTimeout(connectMongo, 5000);
    });
};

connectMongo();

export const closeMongoConnection = async () => {
  await mongoClient.close();
  logger.info('MongoDB connection closed');
};

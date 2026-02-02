"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeMongoDBConnection = exports.getMongoDb = exports.connectMongoDB = void 0;
const mongodb_1 = require("mongodb");
const logger_1 = require("../utils/logger");
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/analytics_db';
let client;
let db;
const connectMongoDB = async () => {
    try {
        client = new mongodb_1.MongoClient(mongoUri, {
            maxPoolSize: 10,
            minPoolSize: 2
        });
        await client.connect();
        db = client.db();
        logger_1.logger.info('MongoDB connected successfully');
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
    }
    catch (error) {
        logger_1.logger.error('MongoDB connection failed:', error);
        throw error;
    }
};
exports.connectMongoDB = connectMongoDB;
const getMongoDb = () => {
    if (!db) {
        throw new Error('MongoDB not connected');
    }
    return db;
};
exports.getMongoDb = getMongoDb;
const closeMongoDBConnection = async () => {
    try {
        if (client) {
            await client.close();
            logger_1.logger.info('MongoDB connection closed');
        }
    }
    catch (error) {
        logger_1.logger.error('Error closing MongoDB connection:', error);
    }
};
exports.closeMongoDBConnection = closeMongoDBConnection;
//# sourceMappingURL=mongodb.connection.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeMongoConnection = exports.mongoClient = void 0;
const mongodb_1 = require("mongodb");
const logger_1 = require("../utils/logger");
const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017';
exports.mongoClient = new mongodb_1.MongoClient(mongoUrl);
exports.mongoClient.on('error', (err) => {
    logger_1.logger.error('MongoDB connection error:', err);
});
// Connect to MongoDB with retry
const connectMongo = () => {
    exports.mongoClient.connect()
        .then(() => {
        logger_1.logger.info('MongoDB connected successfully');
    })
        .catch((err) => {
        logger_1.logger.warn('MongoDB connection failed, will retry in 5s...', err);
        setTimeout(connectMongo, 5000);
    });
};
connectMongo();
const closeMongoConnection = async () => {
    await exports.mongoClient.close();
    logger_1.logger.info('MongoDB connection closed');
};
exports.closeMongoConnection = closeMongoConnection;
//# sourceMappingURL=mongodb.connection.js.map
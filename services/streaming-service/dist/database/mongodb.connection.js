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
exports.mongoClient.connect()
    .then(() => {
    logger_1.logger.info('MongoDB connected successfully');
})
    .catch((err) => {
    logger_1.logger.error('MongoDB connection failed:', err);
    process.exit(1);
});
const closeMongoConnection = async () => {
    await exports.mongoClient.close();
    logger_1.logger.info('MongoDB connection closed');
};
exports.closeMongoConnection = closeMongoConnection;
//# sourceMappingURL=mongodb.connection.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectKafkaConsumer = exports.connectKafkaConsumer = exports.disconnectKafkaProducer = exports.connectKafkaProducer = exports.kafkaProducer = exports.kafkaConsumer = exports.kafka = void 0;
const kafkajs_1 = require("kafkajs");
const logger_1 = require("../utils/logger");
const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const clientId = 'analytics-service';
const groupId = process.env.KAFKA_CONSUMER_GROUP || 'analytics-service';
exports.kafka = new kafkajs_1.Kafka({
    clientId,
    brokers,
    logLevel: kafkajs_1.logLevel.INFO,
    connectionTimeout: 10000,
    retry: {
        maxRetryTime: 30000,
        initialRetryTime: 100,
        multiplier: 2,
        retries: 8,
    },
});
exports.kafkaConsumer = exports.kafka.consumer({ groupId });
exports.kafkaProducer = exports.kafka.producer({
    idempotent: true,
    maxInFlightRequests: 5,
});
const connectKafkaProducer = async () => {
    try {
        await exports.kafkaProducer.connect();
        logger_1.logger.info('Kafka producer connected');
    }
    catch (error) {
        logger_1.logger.error('Failed to connect Kafka producer:', error);
        throw error;
    }
};
exports.connectKafkaProducer = connectKafkaProducer;
const disconnectKafkaProducer = async () => {
    try {
        await exports.kafkaProducer.disconnect();
        logger_1.logger.info('Kafka producer disconnected');
    }
    catch (error) {
        logger_1.logger.error('Failed to disconnect Kafka producer:', error);
    }
};
exports.disconnectKafkaProducer = disconnectKafkaProducer;
const connectKafkaConsumer = async () => {
    try {
        await exports.kafkaConsumer.connect();
        logger_1.logger.info('Kafka consumer connected');
    }
    catch (error) {
        logger_1.logger.error('Failed to connect Kafka consumer:', error);
        throw error;
    }
};
exports.connectKafkaConsumer = connectKafkaConsumer;
const disconnectKafkaConsumer = async () => {
    try {
        await exports.kafkaConsumer.disconnect();
        logger_1.logger.info('Kafka consumer disconnected');
    }
    catch (error) {
        logger_1.logger.error('Failed to disconnect Kafka consumer:', error);
    }
};
exports.disconnectKafkaConsumer = disconnectKafkaConsumer;
//# sourceMappingURL=kafka.js.map
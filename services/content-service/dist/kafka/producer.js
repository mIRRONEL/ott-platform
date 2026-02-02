"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectProducer = exports.kafkaProducer = void 0;
const kafkajs_1 = require("kafkajs");
const logger_1 = require("../utils/logger");
const kafka = new kafkajs_1.Kafka({
    clientId: 'content-service',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    retry: {
        initialRetryTime: 100,
        retries: 8
    }
});
exports.kafkaProducer = kafka.producer({
    idempotent: true,
    maxInFlightRequests: 5
});
// Auto-connect with retry logic (non-blocking)
const autoConnect = () => {
    exports.kafkaProducer.connect()
        .then(() => {
        logger_1.logger.info('Kafka producer connected');
    })
        .catch((err) => {
        logger_1.logger.warn('Kafka producer connection failed, will retry in 5s...', err);
        setTimeout(autoConnect, 5000);
    });
};
// Start connection attempt in background
autoConnect();
exports.kafkaProducer.on('producer.connect', () => {
    logger_1.logger.info('Kafka producer reconnected');
});
exports.kafkaProducer.on('producer.disconnect', () => {
    logger_1.logger.warn('Kafka producer disconnected');
});
const disconnectProducer = async () => {
    await exports.kafkaProducer.disconnect();
    logger_1.logger.info('Kafka producer disconnected');
};
exports.disconnectProducer = disconnectProducer;
//# sourceMappingURL=producer.js.map
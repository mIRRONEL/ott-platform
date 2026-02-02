"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectProducer = exports.kafkaProducer = void 0;
const kafkajs_1 = require("kafkajs");
const logger_1 = require("../utils/logger");
const kafka = new kafkajs_1.Kafka({
    clientId: 'streaming-service',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    retry: {
        initialRetryTime: 100,
        retries: 8
    }
});
exports.kafkaProducer = kafka.producer({
    idempotent: true,
    maxInFlightRequests: 5,
});
exports.kafkaProducer.connect()
    .then(() => {
    logger_1.logger.info('Kafka producer connected');
})
    .catch((err) => {
    logger_1.logger.error('Kafka producer connection failed:', err);
    process.exit(1);
});
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
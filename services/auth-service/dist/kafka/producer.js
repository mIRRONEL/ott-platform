"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.producer = void 0;
exports.connectKafka = connectKafka;
exports.disconnectKafka = disconnectKafka;
const kafkajs_1 = require("kafkajs");
const logger_1 = require("../utils/logger");
const kafka = new kafkajs_1.Kafka({
    clientId: 'auth-service',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    logLevel: kafkajs_1.logLevel.ERROR
});
exports.producer = kafka.producer();
async function connectKafka() {
    try {
        await exports.producer.connect();
        logger_1.logger.info('Kafka Producer connected successfully');
    }
    catch (error) {
        logger_1.logger.error('Kafka connection failed', error);
        throw error;
    }
}
async function disconnectKafka() {
    try {
        await exports.producer.disconnect();
        logger_1.logger.info('Kafka Producer disconnected');
    }
    catch (error) {
        logger_1.logger.error('Kafka disconnection failed', error);
    }
}
exports.default = kafka;
//# sourceMappingURL=producer.js.map
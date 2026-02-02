"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectConsumer = exports.initializeKafkaConsumer = void 0;
const kafkajs_1 = require("kafkajs");
const logger_1 = require("../utils/logger");
const email_service_1 = require("../services/email.service");
const sms_service_1 = require("../services/sms.service");
const push_service_1 = require("../services/push.service");
const kafka = new kafkajs_1.Kafka({
    clientId: 'notification-service',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    retry: {
        initialRetryTime: 100,
        retries: 8
    }
});
let consumer;
const initializeKafkaConsumer = async () => {
    consumer = kafka.consumer({ groupId: 'notification-service-group' });
    await consumer.connect();
    logger_1.logger.info('Kafka consumer connected');
    // Subscribe to notification topics
    await consumer.subscribe({
        topics: [
            'subscription.created',
            'subscription.renewed',
            'subscription.expiring_soon',
            'payment.success',
            'payment.failed',
            'user.registered',
            'video.ready'
        ],
        fromBeginning: false
    });
    // Start consuming messages
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            try {
                const value = message.value?.toString();
                if (!value)
                    return;
                const event = JSON.parse(value);
                switch (topic) {
                    case 'subscription.created':
                        await handleSubscriptionCreated(event);
                        break;
                    case 'subscription.renewed':
                        await handleSubscriptionRenewed(event);
                        break;
                    case 'subscription.expiring_soon':
                        await handleSubscriptionExpiring(event);
                        break;
                    case 'payment.success':
                        await handlePaymentSuccess(event);
                        break;
                    case 'payment.failed':
                        await handlePaymentFailed(event);
                        break;
                    case 'user.registered':
                        await handleUserRegistered(event);
                        break;
                    case 'video.ready':
                        await handleVideoReady(event);
                        break;
                    default:
                        logger_1.logger.warn(`Unknown topic: ${topic}`);
                }
            }
            catch (error) {
                logger_1.logger.error(`Error processing message from topic ${topic}:`, error);
            }
        }
    });
};
exports.initializeKafkaConsumer = initializeKafkaConsumer;
async function handleSubscriptionCreated(event) {
    logger_1.logger.info('Subscription created event received:', event);
    const { userId, planName, amount, currency, billingCycle } = event;
    await (0, email_service_1.sendEmail)(`user_${userId}@example.com`, // Replace with actual email from user service
    'Subscription Confirmation', 'subscription_created', {
        firstName: 'User',
        planName,
        amount,
        currency,
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toDateString()
    });
    await (0, push_service_1.sendPushNotification)(userId, `Your ${planName} subscription is now active!`);
}
async function handleSubscriptionRenewed(event) {
    logger_1.logger.info('Subscription renewed event received:', event);
    const { userId, planName, amount, currency } = event;
    await (0, email_service_1.sendEmail)(`user_${userId}@example.com`, 'Subscription Renewed', 'subscription_created', {
        firstName: 'User',
        planName,
        amount,
        currency,
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toDateString()
    });
}
async function handleSubscriptionExpiring(event) {
    logger_1.logger.info('Subscription expiring soon event received:', event);
    const { userId, planName, expirationDate } = event;
    await (0, email_service_1.sendEmail)(`user_${userId}@example.com`, 'Your Subscription is Expiring Soon', 'subscription_expiring', {
        firstName: 'User',
        planName,
        expirationDate,
        renewLink: 'https://ottplatform.com/renew'
    });
    await (0, push_service_1.sendPushNotification)(userId, `Your ${planName} subscription expires on ${expirationDate}`);
}
async function handlePaymentSuccess(event) {
    logger_1.logger.info('Payment success event received:', event);
    const { userId, amount, currency, invoiceNumber } = event;
    await (0, email_service_1.sendEmail)(`user_${userId}@example.com`, 'Payment Received', 'payment_success', {
        firstName: 'User',
        amount,
        currency,
        invoiceNumber
    });
    await (0, push_service_1.sendPushNotification)(userId, `Payment of ${amount} ${currency} received successfully`);
}
async function handlePaymentFailed(event) {
    logger_1.logger.info('Payment failed event received:', event);
    const { userId, amount, currency, reason } = event;
    await (0, email_service_1.sendEmail)(`user_${userId}@example.com`, 'Payment Failed', 'account_security', {
        firstName: 'User',
        amount,
        currency,
        reason,
        securityLink: 'https://ottplatform.com/account'
    });
    await (0, push_service_1.sendPushNotification)(userId, 'Payment failed. Please update your payment method.');
}
async function handleUserRegistered(event) {
    logger_1.logger.info('User registered event received:', event);
    const { userId, email, firstName } = event;
    // Send welcome email
    await (0, email_service_1.sendEmail)(email, 'Welcome to OTT Platform', 'welcome', {
        firstName,
        activationLink: `https://ottplatform.com/activate/${userId}`,
        platformName: 'OTT Platform'
    });
    // Send SMS if phone provided
    if (event.phone) {
        await (0, sms_service_1.sendSMS)(event.phone, 'verification_code', {
            platformName: 'OTT Platform',
            code: event.verificationCode
        });
    }
}
async function handleVideoReady(event) {
    logger_1.logger.info('Video ready event received:', event);
    const { videoId, videoTitle, category } = event;
    // Get users interested in this category
    // Send notifications to relevant users
    // This would typically query a preferences database
}
const disconnectConsumer = async () => {
    if (consumer) {
        await consumer.disconnect();
        logger_1.logger.info('Kafka consumer disconnected');
    }
};
exports.disconnectConsumer = disconnectConsumer;
//# sourceMappingURL=consumer.js.map
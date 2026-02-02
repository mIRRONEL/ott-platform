import { Kafka, Consumer } from 'kafkajs';
import { logger } from '../utils/logger';
import { sendEmail } from '../services/email.service';
import { sendSMS } from '../services/sms.service';
import { sendPushNotification } from '../services/push.service';

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

let consumer: Consumer;
let isConnecting = false;

export const initializeKafkaConsumer = async () => {
  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    logger.info('Kafka consumer connection already in progress');
    return;
  }

  isConnecting = true;

  try {
    consumer = kafka.consumer({ groupId: 'notification-service-group' });

    await consumer.connect();
    logger.info('Kafka consumer connected');

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
          if (!value) return;

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
            logger.warn(`Unknown topic: ${topic}`);
          }
        } catch (error) {
          logger.error(`Error processing message from topic ${topic}:`, error);
        }
      }
    });
  } catch (error) {
    logger.warn('Failed to initialize Kafka consumer, will retry:', error);
    isConnecting = false;
    // Don't throw - let the caller handle retry logic
  }
};

async function handleSubscriptionCreated(event: any) {
  logger.info('Subscription created event received:', event);

  const { userId, planName, amount, currency, billingCycle } = event;

  await sendEmail(
    `user_${userId}@example.com`, // Replace with actual email from user service
    'Subscription Confirmation',
    'subscription_created',
    {
      firstName: 'User',
      planName,
      amount,
      currency,
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toDateString()
    }
  );

  await sendPushNotification(
    userId,
    `Your ${planName} subscription is now active!`
  );
}

async function handleSubscriptionRenewed(event: any) {
  logger.info('Subscription renewed event received:', event);

  const { userId, planName, amount, currency } = event;

  await sendEmail(
    `user_${userId}@example.com`,
    'Subscription Renewed',
    'subscription_created',
    {
      firstName: 'User',
      planName,
      amount,
      currency,
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toDateString()
    }
  );
}

async function handleSubscriptionExpiring(event: any) {
  logger.info('Subscription expiring soon event received:', event);

  const { userId, planName, expirationDate } = event;

  await sendEmail(
    `user_${userId}@example.com`,
    'Your Subscription is Expiring Soon',
    'subscription_expiring',
    {
      firstName: 'User',
      planName,
      expirationDate,
      renewLink: 'https://ottplatform.com/renew'
    }
  );

  await sendPushNotification(
    userId,
    `Your ${planName} subscription expires on ${expirationDate}`
  );
}

async function handlePaymentSuccess(event: any) {
  logger.info('Payment success event received:', event);

  const { userId, amount, currency, invoiceNumber } = event;

  await sendEmail(
    `user_${userId}@example.com`,
    'Payment Received',
    'payment_success',
    {
      firstName: 'User',
      amount,
      currency,
      invoiceNumber
    }
  );

  await sendPushNotification(
    userId,
    `Payment of ${amount} ${currency} received successfully`
  );
}

async function handlePaymentFailed(event: any) {
  logger.info('Payment failed event received:', event);

  const { userId, amount, currency, reason } = event;

  await sendEmail(
    `user_${userId}@example.com`,
    'Payment Failed',
    'account_security',
    {
      firstName: 'User',
      amount,
      currency,
      reason,
      securityLink: 'https://ottplatform.com/account'
    }
  );

  await sendPushNotification(
    userId,
    'Payment failed. Please update your payment method.'
  );
}

async function handleUserRegistered(event: any) {
  logger.info('User registered event received:', event);

  const { userId, email, firstName } = event;

  // Send welcome email
  await sendEmail(
    email,
    'Welcome to OTT Platform',
    'welcome',
    {
      firstName,
      activationLink: `https://ottplatform.com/activate/${userId}`,
      platformName: 'OTT Platform'
    }
  );

  // Send SMS if phone provided
  if (event.phone) {
    await sendSMS(
      event.phone,
      'verification_code',
      {
        platformName: 'OTT Platform',
        code: event.verificationCode
      }
    );
  }
}

async function handleVideoReady(event: any) {
  logger.info('Video ready event received:', event);

  const { videoId, videoTitle, category } = event;

  // Get users interested in this category
  // Send notifications to relevant users
  // This would typically query a preferences database
}

export const disconnectConsumer = async () => {
  if (consumer) {
    await consumer.disconnect();
    logger.info('Kafka consumer disconnected');
  }
};

import admin from 'firebase-admin';
import { logger } from '../utils/logger';

let firebaseInitialized = false;

const initializeFirebase = () => {
  try {
    if (!firebaseInitialized && !admin.apps.length) {
      const serviceAccount = require(process.env.FIREBASE_KEY_PATH || './firebase-key.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      firebaseInitialized = true;
      logger.info('Firebase Admin SDK initialized');
    }
  } catch (err) {
    logger.warn('Firebase initialization failed:', err);
    // Don't throw - push notifications will gracefully fail
    // but the service will continue running
  }
};

const pushTemplates: any = {
  'new_content': {
    title: 'New Content Available',
    body: 'Check out {{contentTitle}}'
  },
  'recommendation': {
    title: 'Recommended for You',
    body: 'We think you\'ll enjoy {{contentTitle}}'
  },
  'subscription_reminder': {
    title: 'Subscription Reminder',
    body: 'Your {{planName}} renews on {{date}}'
  },
  'watchlist_available': {
    title: 'Watchlist Item Available',
    body: '{{contentTitle}} is now available'
  },
  'promotion': {
    title: '{{promotionName}}',
    body: '{{description}}'
  },
  'account_alert': {
    title: 'Account Alert',
    body: '{{message}}'
  }
};

export const sendPushNotification = async (
  userId: string,
  title: string,
  templateData: any = {}
): Promise<{ success: boolean; externalId?: string; error?: string }> => {
  try {
    // Initialize Firebase if not already done
    initializeFirebase();

    // Get user's FCM tokens from database/cache
    // This would typically be stored when user registers device
    const userTokens = await getUserFCMTokens(userId);

    if (!userTokens || userTokens.length === 0) {
      logger.warn(`No FCM tokens found for user: ${userId}`);
      return { success: false, error: 'No devices registered' };
    }

    // Build notification
    const notification = {
      title,
      body: title
    };

    const data = {
      ...templateData,
      timestamp: new Date().toISOString()
    };

    // Send to all user devices
    const response = await admin.messaging().sendMulticast({
      tokens: userTokens,
      notification,
      data: data as any
    });

    logger.info(`Push notification sent to ${userId}`, {
      successCount: response.successCount,
      failureCount: response.failureCount
    });

    // Handle failed tokens
    if (response.failureCount > 0) {
      const failedTokens = response.responses
        .map((resp, idx) => !resp.success ? userTokens[idx] : null)
        .filter(Boolean);

      // Remove invalid tokens
      await removeInvalidFCMTokens(userId, failedTokens as string[]);
    }

    return {
      success: response.successCount > 0,
      externalId: response.responses[0]?.messageId || 'multiple'
    };
  } catch (error) {
    logger.error(`Failed to send push notification to ${userId}:`, error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
};

export const sendBulkPushNotifications = async (
  userIds: string[],
  title: string,
  templateData: any = {}
): Promise<{ success: number; failed: number; errors: string[] }> => {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const userId of userIds) {
    const result = await sendPushNotification(userId, title, templateData);
    if (result.success) {
      success++;
    } else {
      failed++;
      errors.push(`${userId}: ${result.error}`);
    }
  }

  return { success, failed, errors };
};

// Helper functions

async function getUserFCMTokens(userId: string): Promise<string[]> {
  // This is a placeholder - implement actual token retrieval
  // Typically store FCM tokens in Redis or MongoDB
  return [];
}

async function removeInvalidFCMTokens(userId: string, tokens: string[]): Promise<void> {
  // Remove invalid tokens from database
  // Implementation depends on where you store FCM tokens
  logger.info(`Removed ${tokens.length} invalid FCM tokens for user ${userId}`);
}

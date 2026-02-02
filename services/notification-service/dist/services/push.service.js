"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendBulkPushNotifications = exports.sendPushNotification = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const logger_1 = require("../utils/logger");
// Initialize Firebase Admin SDK
const serviceAccount = require(process.env.FIREBASE_KEY_PATH || './firebase-key.json');
firebase_admin_1.default.initializeApp({
    credential: firebase_admin_1.default.credential.cert(serviceAccount)
});
const pushTemplates = {
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
const sendPushNotification = async (userId, title, templateData = {}) => {
    try {
        // Get user's FCM tokens from database/cache
        // This would typically be stored when user registers device
        const userTokens = await getUserFCMTokens(userId);
        if (!userTokens || userTokens.length === 0) {
            logger_1.logger.warn(`No FCM tokens found for user: ${userId}`);
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
        const response = await firebase_admin_1.default.messaging().sendMulticast({
            tokens: userTokens,
            notification,
            data: data
        });
        logger_1.logger.info(`Push notification sent to ${userId}`, {
            successCount: response.successCount,
            failureCount: response.failureCount
        });
        // Handle failed tokens
        if (response.failureCount > 0) {
            const failedTokens = response.responses
                .map((resp, idx) => !resp.success ? userTokens[idx] : null)
                .filter(Boolean);
            // Remove invalid tokens
            await removeInvalidFCMTokens(userId, failedTokens);
        }
        return {
            success: response.successCount > 0,
            externalId: response.responses[0]?.messageId || 'multiple'
        };
    }
    catch (error) {
        logger_1.logger.error(`Failed to send push notification to ${userId}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
};
exports.sendPushNotification = sendPushNotification;
const sendBulkPushNotifications = async (userIds, title, templateData = {}) => {
    let success = 0;
    let failed = 0;
    const errors = [];
    for (const userId of userIds) {
        const result = await (0, exports.sendPushNotification)(userId, title, templateData);
        if (result.success) {
            success++;
        }
        else {
            failed++;
            errors.push(`${userId}: ${result.error}`);
        }
    }
    return { success, failed, errors };
};
exports.sendBulkPushNotifications = sendBulkPushNotifications;
// Helper functions
async function getUserFCMTokens(userId) {
    // This is a placeholder - implement actual token retrieval
    // Typically store FCM tokens in Redis or MongoDB
    return [];
}
async function removeInvalidFCMTokens(userId, tokens) {
    // Remove invalid tokens from database
    // Implementation depends on where you store FCM tokens
    logger_1.logger.info(`Removed ${tokens.length} invalid FCM tokens for user ${userId}`);
}
//# sourceMappingURL=push.service.js.map
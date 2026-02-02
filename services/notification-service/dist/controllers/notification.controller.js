"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPhone = exports.verifyEmail = exports.getUnreadCount = exports.deleteNotification = exports.markAsRead = exports.getNotificationHistory = exports.sendNotification = exports.updateNotificationPreferences = exports.getNotificationPreferences = void 0;
const uuid_1 = require("uuid");
const connection_1 = require("../database/connection");
const mongodb_connection_1 = require("../database/mongodb.connection");
const redis_1 = require("../config/redis");
const logger_1 = require("../utils/logger");
const email_service_1 = require("../services/email.service");
const sms_service_1 = require("../services/sms.service");
const push_service_1 = require("../services/push.service");
const errors_1 = require("../utils/errors");
/**
 * Get notification preferences
 */
const getNotificationPreferences = async (req, res, next) => {
    try {
        const { userId } = req.params;
        // Check cache
        const cachedPrefs = await redis_1.redisClient.get(`notification_prefs:${userId}`);
        if (cachedPrefs) {
            logger_1.logger.info(`Notification preferences from cache: ${userId}`);
            res.status(200).json({
                status: 'success',
                data: JSON.parse(cachedPrefs),
                source: 'cache'
            });
            return;
        }
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const preferencesCollection = mongoDb.collection('notification_preferences');
        let preferences = await preferencesCollection.findOne({ userId });
        if (!preferences) {
            // Return default preferences
            preferences = {
                userId,
                email: {
                    newReleases: true,
                    subscriptionUpdates: true,
                    recommendations: true,
                    newsletter: true,
                    paymentReceipts: true,
                    securityAlerts: true
                },
                sms: {
                    promotions: false,
                    accountUpdates: true,
                    verificationCodes: true
                },
                push: {
                    newContent: true,
                    watchlistUpdates: true,
                    recommendations: true,
                    reminders: false
                },
                notificationFrequency: 'immediate'
            };
        }
        // Cache for 1 hour
        await redis_1.redisClient.setEx(`notification_prefs:${userId}`, 3600, JSON.stringify(preferences));
        res.status(200).json({
            status: 'success',
            data: preferences
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getNotificationPreferences = getNotificationPreferences;
/**
 * Update notification preferences
 */
const updateNotificationPreferences = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const preferences = req.body;
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const preferencesCollection = mongoDb.collection('notification_preferences');
        const result = await preferencesCollection.updateOne({ userId }, {
            $set: {
                ...preferences,
                updatedAt: new Date()
            }
        }, { upsert: true });
        // Invalidate cache
        await redis_1.redisClient.del(`notification_prefs:${userId}`);
        logger_1.logger.info(`Notification preferences updated: ${userId}`);
        res.status(200).json({
            status: 'success',
            message: 'Preferences updated successfully',
            data: preferences
        });
    }
    catch (error) {
        next(error);
    }
};
exports.updateNotificationPreferences = updateNotificationPreferences;
/**
 * Send notification
 */
const sendNotification = async (req, res, next) => {
    try {
        const { userId, type, templateId, subject, recipient, templateData, priority } = req.body;
        const notificationId = (0, uuid_1.v4)();
        // Get user preferences
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const preferencesCollection = mongoDb.collection('notification_preferences');
        const preferences = await preferencesCollection.findOne({ userId });
        // Check if user has opted out
        if (preferences) {
            const typePrefs = preferences[type];
            if (typePrefs === false) {
                throw new errors_1.ValidationError(`User has opted out of ${type} notifications`);
            }
        }
        // Record notification
        const notificationsCollection = mongoDb.collection('notifications');
        const notificationRecord = {
            _id: notificationId,
            userId,
            type,
            templateId,
            subject,
            recipient,
            status: 'pending',
            createdAt: new Date(),
            read: false,
            priority: priority || 'normal'
        };
        await notificationsCollection.insertOne(notificationRecord);
        // Send notification based on type
        let sendResult = { success: false };
        try {
            if (type === 'email') {
                sendResult = await (0, email_service_1.sendEmail)(recipient, subject || '', templateId, templateData);
            }
            else if (type === 'sms') {
                sendResult = await (0, sms_service_1.sendSMS)(recipient, templateId, templateData);
            }
            else if (type === 'push') {
                sendResult = await (0, push_service_1.sendPushNotification)(userId, subject || '', templateData);
            }
            // Update notification status
            await notificationsCollection.updateOne({ _id: notificationId }, {
                $set: {
                    status: sendResult.success ? 'sent' : 'failed',
                    sentAt: new Date(),
                    externalId: sendResult.externalId || null,
                    error: sendResult.error || null
                }
            });
            if (!sendResult.success) {
                logger_1.logger.warn(`Notification delivery failed: ${notificationId} - ${sendResult.error}`);
            }
            else {
                logger_1.logger.info(`Notification sent: ${notificationId} - Type: ${type} - User: ${userId}`);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error sending notification: ${notificationId}`, error);
            await notificationsCollection.updateOne({ _id: notificationId }, {
                $set: {
                    status: 'failed',
                    error: error.message
                }
            });
        }
        res.status(201).json({
            status: 'success',
            message: 'Notification queued for delivery',
            data: {
                notificationId,
                status: sendResult.success ? 'sent' : 'pending'
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.sendNotification = sendNotification;
/**
 * Get notification history
 */
const getNotificationHistory = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20, type } = req.query;
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const notificationsCollection = mongoDb.collection('notifications');
        const query = { userId };
        if (type)
            query.type = type;
        const skip = ((Number(page) - 1) * Number(limit));
        const notifications = await notificationsCollection
            .find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .toArray();
        const total = await notificationsCollection.countDocuments(query);
        logger_1.logger.info(`Notification history retrieved: ${userId}`);
        res.status(200).json({
            status: 'success',
            data: notifications,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getNotificationHistory = getNotificationHistory;
/**
 * Mark notification as read
 */
const markAsRead = async (req, res, next) => {
    try {
        const { notificationId } = req.params;
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const notificationsCollection = mongoDb.collection('notifications');
        const result = await notificationsCollection.updateOne({ _id: notificationId }, { $set: { read: true, readAt: new Date() } });
        if (result.matchedCount === 0) {
            throw new errors_1.NotFoundError('Notification not found');
        }
        logger_1.logger.info(`Notification marked as read: ${notificationId}`);
        res.status(200).json({
            status: 'success',
            message: 'Notification marked as read'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.markAsRead = markAsRead;
/**
 * Delete notification
 */
const deleteNotification = async (req, res, next) => {
    try {
        const { notificationId } = req.params;
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const notificationsCollection = mongoDb.collection('notifications');
        const result = await notificationsCollection.deleteOne({
            _id: notificationId
        });
        if (result.deletedCount === 0) {
            throw new errors_1.NotFoundError('Notification not found');
        }
        logger_1.logger.info(`Notification deleted: ${notificationId}`);
        res.status(200).json({
            status: 'success',
            message: 'Notification deleted'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteNotification = deleteNotification;
/**
 * Get unread count
 */
const getUnreadCount = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const mongoDb = mongodb_connection_1.mongoClient.db('ott_platform');
        const notificationsCollection = mongoDb.collection('notifications');
        const unreadCount = await notificationsCollection.countDocuments({
            userId,
            read: false
        });
        logger_1.logger.info(`Unread count retrieved: ${userId} - Count: ${unreadCount}`);
        res.status(200).json({
            status: 'success',
            data: { unreadCount }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getUnreadCount = getUnreadCount;
/**
 * Verify email
 */
const verifyEmail = async (req, res, next) => {
    try {
        const { userId, code } = req.body;
        // Get verification code from Redis
        const storedCode = await redis_1.redisClient.get(`email_verification:${userId}`);
        if (!storedCode || storedCode !== code) {
            throw new errors_1.ValidationError('Invalid or expired verification code');
        }
        // Update user email_verified in PostgreSQL
        const query = 'UPDATE users SET email_verified = true WHERE id = $1';
        await connection_1.pool.query(query, [userId]);
        // Remove verification code
        await redis_1.redisClient.del(`email_verification:${userId}`);
        logger_1.logger.info(`Email verified: ${userId}`);
        res.status(200).json({
            status: 'success',
            message: 'Email verified successfully'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.verifyEmail = verifyEmail;
/**
 * Verify phone
 */
const verifyPhone = async (req, res, next) => {
    try {
        const { userId, code } = req.body;
        // Get verification code from Redis
        const storedCode = await redis_1.redisClient.get(`phone_verification:${userId}`);
        if (!storedCode || storedCode !== code) {
            throw new errors_1.ValidationError('Invalid or expired verification code');
        }
        // Update user phone_verified in PostgreSQL
        const query = 'UPDATE users SET phone_verified = true WHERE id = $1';
        await connection_1.pool.query(query, [userId]);
        // Remove verification code
        await redis_1.redisClient.del(`phone_verification:${userId}`);
        logger_1.logger.info(`Phone verified: ${userId}`);
        res.status(200).json({
            status: 'success',
            message: 'Phone verified successfully'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.verifyPhone = verifyPhone;
//# sourceMappingURL=notification.controller.js.map
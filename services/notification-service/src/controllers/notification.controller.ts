import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../database/connection';
import { mongoClient } from '../database/mongodb.connection';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { sendEmail } from '../services/email.service';
import { sendSMS } from '../services/sms.service';
import { sendPushNotification } from '../services/push.service';
import { NotFoundError, ValidationError } from '../utils/errors';

/**
 * Get notification preferences
 */
export const getNotificationPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    // Check cache
    const cachedPrefs = await redisClient.get(`notification_prefs:${userId}`);
    if (cachedPrefs) {
      logger.info(`Notification preferences from cache: ${userId}`);
      res.status(200).json({
        status: 'success',
        data: JSON.parse(cachedPrefs),
        source: 'cache'
      });
      return;
    }

    const mongoDb = mongoClient.db('ott_platform');
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
      } as any;
    }

    // Cache for 1 hour
    await redisClient.setEx(
      `notification_prefs:${userId}`,
      3600,
      JSON.stringify(preferences)
    );

    res.status(200).json({
      status: 'success',
      data: preferences
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update notification preferences
 */
export const updateNotificationPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const preferences = req.body;

    const mongoDb = mongoClient.db('ott_platform');
    const preferencesCollection = mongoDb.collection('notification_preferences');

    const result = await preferencesCollection.updateOne(
      { userId },
      {
        $set: {
          ...preferences,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    // Invalidate cache
    await redisClient.del(`notification_prefs:${userId}`);

    logger.info(`Notification preferences updated: ${userId}`);

    res.status(200).json({
      status: 'success',
      message: 'Preferences updated successfully',
      data: preferences
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send notification
 */
export const sendNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      userId,
      type,
      templateId,
      subject,
      recipient,
      templateData,
      priority
    } = req.body;

    const notificationId = uuidv4();

    // Get user preferences
    const mongoDb = mongoClient.db('ott_platform');
    const preferencesCollection = mongoDb.collection('notification_preferences');
    const preferences = await preferencesCollection.findOne({ userId });

    // Check if user has opted out
    if (preferences) {
      const typePrefs = preferences[type as keyof typeof preferences];
      if (typePrefs === false) {
        throw new ValidationError(`User has opted out of ${type} notifications`);
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
    } as any;

    await notificationsCollection.insertOne(notificationRecord);

    // Send notification based on type
    let sendResult: any = { success: false };

    try {
      if (type === 'email') {
        sendResult = await sendEmail(recipient, subject || '', templateId, templateData);
      } else if (type === 'sms') {
        sendResult = await sendSMS(recipient, templateId, templateData);
      } else if (type === 'push') {
        sendResult = await sendPushNotification(userId, subject || '', templateData);
      }

      // Update notification status
      await notificationsCollection.updateOne(
        { _id: notificationId } as any,
        {
          $set: {
            status: sendResult.success ? 'sent' : 'failed',
            sentAt: new Date(),
            externalId: sendResult.externalId || null,
            error: sendResult.error || null
          }
        }
      );

      if (!sendResult.success) {
        logger.warn(`Notification delivery failed: ${notificationId} - ${sendResult.error}`);
      } else {
        logger.info(`Notification sent: ${notificationId} - Type: ${type} - User: ${userId}`);
      }
    } catch (error) {
      logger.error(`Error sending notification: ${notificationId}`, error);
      
      await notificationsCollection.updateOne(
        { _id: notificationId } as any,
        {
          $set: {
            status: 'failed',
            error: (error as Error).message
          }
        }
      );
    }

    res.status(201).json({
      status: 'success',
      message: 'Notification queued for delivery',
      data: {
        notificationId,
        status: sendResult.success ? 'sent' : 'pending'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get notification history
 */
export const getNotificationHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, type } = req.query;

    const mongoDb = mongoClient.db('ott_platform');
    const notificationsCollection = mongoDb.collection('notifications');

    const query: any = { userId };
    if (type) query.type = type;

    const skip = ((Number(page) - 1) * Number(limit));

    const notifications = await notificationsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .toArray();

    const total = await notificationsCollection.countDocuments(query);

    logger.info(`Notification history retrieved: ${userId}`);

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
  } catch (error) {
    next(error);
  }
};

/**
 * Mark notification as read
 */
export const markAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { notificationId } = req.params;

    const mongoDb = mongoClient.db('ott_platform');
    const notificationsCollection = mongoDb.collection('notifications');

    const result = await notificationsCollection.updateOne(
      { _id: notificationId } as any,
      { $set: { read: true, readAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      throw new NotFoundError('Notification not found');
    }

    logger.info(`Notification marked as read: ${notificationId}`);

    res.status(200).json({
      status: 'success',
      message: 'Notification marked as read'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete notification
 */
export const deleteNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { notificationId } = req.params;

    const mongoDb = mongoClient.db('ott_platform');
    const notificationsCollection = mongoDb.collection('notifications');

    const result = await notificationsCollection.deleteOne({
      _id: notificationId
    } as any);

    if (result.deletedCount === 0) {
      throw new NotFoundError('Notification not found');
    }

    logger.info(`Notification deleted: ${notificationId}`);

    res.status(200).json({
      status: 'success',
      message: 'Notification deleted'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread count
 */
export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    const mongoDb = mongoClient.db('ott_platform');
    const notificationsCollection = mongoDb.collection('notifications');

    const unreadCount = await notificationsCollection.countDocuments({
      userId,
      read: false
    });

    logger.info(`Unread count retrieved: ${userId} - Count: ${unreadCount}`);

    res.status(200).json({
      status: 'success',
      data: { unreadCount }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify email
 */
export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId, code } = req.body;

    // Get verification code from Redis
    const storedCode = await redisClient.get(`email_verification:${userId}`);

    if (!storedCode || storedCode !== code) {
      throw new ValidationError('Invalid or expired verification code');
    }

    // Update user email_verified in PostgreSQL
    const query = 'UPDATE users SET email_verified = true WHERE id = $1';
    await pool.query(query, [userId]);

    // Remove verification code
    await redisClient.del(`email_verification:${userId}`);

    logger.info(`Email verified: ${userId}`);

    res.status(200).json({
      status: 'success',
      message: 'Email verified successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify phone
 */
export const verifyPhone = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId, code } = req.body;

    // Get verification code from Redis
    const storedCode = await redisClient.get(`phone_verification:${userId}`);

    if (!storedCode || storedCode !== code) {
      throw new ValidationError('Invalid or expired verification code');
    }

    // Update user phone_verified in PostgreSQL
    const query = 'UPDATE users SET phone_verified = true WHERE id = $1';
    await pool.query(query, [userId]);

    // Remove verification code
    await redisClient.del(`phone_verification:${userId}`);

    logger.info(`Phone verified: ${userId}`);

    res.status(200).json({
      status: 'success',
      message: 'Phone verified successfully'
    });
  } catch (error) {
    next(error);
  }
};

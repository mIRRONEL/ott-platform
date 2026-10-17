import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
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
      type = 'info',
      templateId = 'general',
      title,
      subject,
      message,
      recipient,
      templateData,
      priority
    } = req.body;

    const notificationId = uuidv4();
    const resolvedTitle = title || subject || 'System Notification';
    const resolvedMessage = message || templateData?.message || 'New update available.';

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
      title: resolvedTitle,
      subject: resolvedTitle,
      message: resolvedMessage,
      recipient: recipient || 'system',
      status: 'sent',
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
 * Helper to decode user ID from JWT token without extra dependencies
 */
const decodeJwtPayload = (token: string): any => {
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = Buffer.from(parts[1], 'base64').toString('utf8');
      return JSON.parse(payload);
    }
  } catch (_) {}
  return null;
};

export const getRequestUserId = (req: Request): string => {
  if (req.headers['x-user-id']) {
    return String(req.headers['x-user-id']);
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const decoded = decodeJwtPayload(token);
    if (decoded && (decoded.user_id || decoded.userId || decoded.sub || decoded.id)) {
      return String(decoded.user_id || decoded.userId || decoded.sub || decoded.id);
    }
  }
  if (req.query.userId) {
    return String(req.query.userId);
  }
  return 'default_user';
};

/**
 * Get all notifications for current user (with one-time auto-initialization)
 */
/**
 * Get all notifications for current user (with auto-initialization if empty)
 */
export const getUserNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = getRequestUserId(req);
    const { read, page = 1, limit = 50 } = req.query;

    const mongoDb = mongoClient.db('ott_platform');
    const notificationsCollection = mongoDb.collection('notifications');

    const baseQuery: any = {
      $or: [
        { userId },
        { user_id: userId },
        { userId: 'all' },
        { isBroadcast: true }
      ]
    };

    const userMetaCollection = mongoDb.collection('user_inbox_meta');

    // Only auto-seed once per user on first registration/visit
    const meta = await userMetaCollection.findOne({ userId });
    if (!meta) {
      await userMetaCollection.insertOne({ userId, initialized: true, createdAt: new Date() });

      const seedItems = [
        {
          _id: uuidv4(),
          userId,
          title: '🎬 4K Transcoding Completed',
          message: 'Your video "4K Ultra Cinema Showcase" has finished multi-profile HLS encoding (1080p, 720p, 480p, 360p) and is ready to stream.',
          type: 'success',
          read: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 5)
        },
        {
          _id: uuidv4(),
          userId,
          title: '⭐ VIP 4K Ultra HD Plan Active',
          message: 'Welcome to your VIP subscription! Enjoy ad-free streaming, spatial audio, and unlimited cloud downloads.',
          type: 'info',
          read: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2)
        },
        {
          _id: uuidv4(),
          userId,
          title: '🛡️ Security Login Alert',
          message: 'New login session established from authorized IP. Your account is secured with end-to-end token encryption.',
          type: 'warning',
          read: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24)
        }
      ];

      try {
        await notificationsCollection.insertMany(seedItems);
      } catch (insertErr) {
        logger.warn('Seed notifications insert warning:', insertErr);
      }
    }

    const query: any = { ...baseQuery };
    if (read !== undefined) {
      query.read = String(read) === 'true';
    }

    const notifications = await notificationsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .toArray();

    const normalized = notifications.map(item => ({
      id: String(item._id || item.id),
      _id: String(item._id || item.id),
      title: item.title || item.subject || 'Notification',
      message: item.message || item.body || 'No details provided.',
      type: item.type || 'info',
      read: Boolean(item.read),
      createdAt: item.createdAt || item.created_at || new Date().toISOString()
    }));

    res.status(200).json({
      status: 'success',
      data: normalized
    });
  } catch (error) {
    logger.error('Error in getUserNotifications:', error);
    next(error);
  }
};

/**
 * Mark notification as read / acknowledged
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

    const conditions: any[] = [
      { _id: notificationId },
      { id: notificationId }
    ];
    if (ObjectId.isValid(notificationId)) {
      try {
        conditions.push({ _id: new ObjectId(notificationId) });
      } catch (_) {}
    }

    const result = await notificationsCollection.updateOne(
      { $or: conditions },
      { $set: { read: true, readAt: new Date() } }
    );

    logger.info(`Notification marked as read: ${notificationId}, modifiedCount: ${result.modifiedCount}`);

    res.status(200).json({
      status: 'success',
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logger.error('Error in markAsRead:', error);
    next(error);
  }
};

/**
 * Mark all notifications as read for user
 */
export const markAllAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = getRequestUserId(req);
    const mongoDb = mongoClient.db('ott_platform');
    const notificationsCollection = mongoDb.collection('notifications');

    const filter: any = userId ? { $or: [{ userId }, { user_id: userId }, { userId: 'all' }] } : {};
    await notificationsCollection.updateMany(filter, { $set: { read: true, readAt: new Date() } });

    res.status(200).json({
      status: 'success',
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error('Error in markAllAsRead:', error);
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

    const conditions: any[] = [
      { _id: notificationId },
      { id: notificationId }
    ];
    if (ObjectId.isValid(notificationId)) {
      try {
        conditions.push({ _id: new ObjectId(notificationId) });
      } catch (_) {}
    }

    const result = await notificationsCollection.deleteOne({ $or: conditions });
    logger.info(`Notification deleted: ${notificationId}, deletedCount: ${result.deletedCount}`);

    res.status(200).json({
      status: 'success',
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    logger.error('Error in deleteNotification:', error);
    next(error);
  }
};

/**
 * Clear all notifications for user
 */
export const clearAllNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = getRequestUserId(req);
    const mongoDb = mongoClient.db('ott_platform');
    const notificationsCollection = mongoDb.collection('notifications');

    const filter: any = userId ? { $or: [{ userId }, { user_id: userId }, { userId: 'all' }] } : {};
    await notificationsCollection.deleteMany(filter);

    res.status(200).json({
      status: 'success',
      success: true,
      message: 'All notifications cleared'
    });
  } catch (error) {
    logger.error('Error in clearAllNotifications:', error);
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

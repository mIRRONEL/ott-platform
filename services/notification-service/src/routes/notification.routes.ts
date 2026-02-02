import { Router } from 'express';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  sendNotification,
  getNotificationHistory,
  markAsRead,
  deleteNotification,
  getUnreadCount,
  verifyEmail,
  verifyPhone
} from '../controllers/notification.controller';
import { validateRequest } from '../middleware/validation';
import {
  preferencesSchema,
  sendNotificationSchema,
  verificationSchema
} from '../schemas/notification.schema';

const router = Router();

/**
 * @route GET /api/notifications/preferences/:userId
 * @description Get user notification preferences
 * @access Private
 */
router.get('/preferences/:userId', getNotificationPreferences);

/**
 * @route PUT /api/notifications/preferences/:userId
 * @description Update notification preferences
 * @access Private
 */
router.put('/preferences/:userId', validateRequest(preferencesSchema), updateNotificationPreferences);

/**
 * @route POST /api/notifications/send
 * @description Send notification
 * @access Private
 */
router.post('/send', validateRequest(sendNotificationSchema), sendNotification);

/**
 * @route GET /api/notifications/history/:userId
 * @description Get notification history
 * @access Private
 */
router.get('/history/:userId', getNotificationHistory);

/**
 * @route PUT /api/notifications/:notificationId/read
 * @description Mark notification as read
 * @access Private
 */
router.put('/:notificationId/read', markAsRead);

/**
 * @route DELETE /api/notifications/:notificationId
 * @description Delete notification
 * @access Private
 */
router.delete('/:notificationId', deleteNotification);

/**
 * @route GET /api/notifications/unread/:userId
 * @description Get unread count
 * @access Private
 */
router.get('/unread/:userId', getUnreadCount);

/**
 * @route POST /api/notifications/verify-email
 * @description Verify email
 * @access Public
 */
router.post('/verify-email', validateRequest(verificationSchema), verifyEmail);

/**
 * @route POST /api/notifications/verify-phone
 * @description Verify phone
 * @access Public
 */
router.post('/verify-phone', validateRequest(verificationSchema), verifyPhone);

export default router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_controller_1 = require("../controllers/notification.controller");
const validation_1 = require("../middleware/validation");
const notification_schema_1 = require("../schemas/notification.schema");
const router = (0, express_1.Router)();
/**
 * @route GET /api/notifications/preferences/:userId
 * @description Get user notification preferences
 * @access Private
 */
router.get('/preferences/:userId', notification_controller_1.getNotificationPreferences);
/**
 * @route PUT /api/notifications/preferences/:userId
 * @description Update notification preferences
 * @access Private
 */
router.put('/preferences/:userId', (0, validation_1.validateRequest)(notification_schema_1.preferencesSchema), notification_controller_1.updateNotificationPreferences);
/**
 * @route POST /api/notifications/send
 * @description Send notification
 * @access Private
 */
router.post('/send', (0, validation_1.validateRequest)(notification_schema_1.sendNotificationSchema), notification_controller_1.sendNotification);
/**
 * @route GET /api/notifications/history/:userId
 * @description Get notification history
 * @access Private
 */
router.get('/history/:userId', notification_controller_1.getNotificationHistory);
/**
 * @route PUT /api/notifications/:notificationId/read
 * @description Mark notification as read
 * @access Private
 */
router.put('/:notificationId/read', notification_controller_1.markAsRead);
/**
 * @route DELETE /api/notifications/:notificationId
 * @description Delete notification
 * @access Private
 */
router.delete('/:notificationId', notification_controller_1.deleteNotification);
/**
 * @route GET /api/notifications/unread/:userId
 * @description Get unread count
 * @access Private
 */
router.get('/unread/:userId', notification_controller_1.getUnreadCount);
/**
 * @route POST /api/notifications/verify-email
 * @description Verify email
 * @access Public
 */
router.post('/verify-email', (0, validation_1.validateRequest)(notification_schema_1.verificationSchema), notification_controller_1.verifyEmail);
/**
 * @route POST /api/notifications/verify-phone
 * @description Verify phone
 * @access Public
 */
router.post('/verify-phone', (0, validation_1.validateRequest)(notification_schema_1.verificationSchema), notification_controller_1.verifyPhone);
exports.default = router;
//# sourceMappingURL=notification.routes.js.map
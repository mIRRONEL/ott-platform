"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendBulkSMS = exports.sendSMS = void 0;
const twilio_1 = __importDefault(require("twilio"));
const logger_1 = require("../utils/logger");
const twilioClient = (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID || '', process.env.TWILIO_AUTH_TOKEN || '');
const smsTemplates = {
    'verification_code': `Your {{platformName}} verification code is: {{code}}. Do not share this code with anyone.`,
    'password_reset': `Reset your {{platformName}} password: {{resetLink}}. Link expires in 1 hour.`,
    'subscription_alert': `Your {{platformName}} subscription {{status}}. Amount: {{amount}} {{currency}}.`,
    'payment_reminder': `Reminder: Your {{platformName}} payment of {{amount}} {{currency}} is due on {{dueDate}}.`,
    'security_alert': `Security alert on your {{platformName}} account. If this wasn't you, change your password immediately.`,
    'promotion': `{{promotionName}}: {{description}} Valid until {{expirationDate}}. {{promotionLink}}`
};
const sendSMS = async (phoneNumber, templateId, templateData = {}) => {
    try {
        const template = smsTemplates[templateId];
        if (!template) {
            throw new Error(`SMS template not found: ${templateId}`);
        }
        // Build message
        let message = template;
        for (const [key, value] of Object.entries(templateData)) {
            message = message.replace(`{{${key}}}`, String(value));
        }
        // Send SMS via Twilio
        const response = await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
            to: phoneNumber
        });
        logger_1.logger.info(`SMS sent successfully to ${phoneNumber}`, {
            templateId,
            messageSid: response.sid
        });
        return {
            success: true,
            externalId: response.sid
        };
    }
    catch (error) {
        logger_1.logger.error(`Failed to send SMS to ${phoneNumber}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
};
exports.sendSMS = sendSMS;
const sendBulkSMS = async (phoneNumbers, templateId, templateData = {}) => {
    let success = 0;
    let failed = 0;
    const errors = [];
    for (const phoneNumber of phoneNumbers) {
        const result = await (0, exports.sendSMS)(phoneNumber, templateId, templateData);
        if (result.success) {
            success++;
        }
        else {
            failed++;
            errors.push(`${phoneNumber}: ${result.error}`);
        }
    }
    return { success, failed, errors };
};
exports.sendBulkSMS = sendBulkSMS;
//# sourceMappingURL=sms.service.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendBulkEmails = exports.sendEmail = void 0;
const mail_1 = __importDefault(require("@sendgrid/mail"));
const handlebars_1 = __importDefault(require("handlebars"));
const logger_1 = require("../utils/logger");
mail_1.default.setApiKey(process.env.SENDGRID_API_KEY || '');
const emailTemplates = {
    'welcome': `
    <h1>Welcome to {{platformName}}</h1>
    <p>Hi {{firstName}},</p>
    <p>Thank you for joining {{platformName}}! Your account has been created successfully.</p>
    <p><a href="{{activationLink}}">Activate Your Account</a></p>
  `,
    'password_reset': `
    <h1>Reset Your Password</h1>
    <p>Hi {{firstName}},</p>
    <p>We received a request to reset your password. Click the link below:</p>
    <p><a href="{{resetLink}}">Reset Password</a></p>
    <p>This link expires in 1 hour.</p>
  `,
    'subscription_created': `
    <h1>Subscription Confirmed</h1>
    <p>Hi {{firstName}},</p>
    <p>Your {{planName}} subscription is now active.</p>
    <p>Billing Amount: {{amount}} {{currency}}</p>
    <p>Next Billing Date: {{nextBillingDate}}</p>
  `,
    'subscription_expiring': `
    <h1>Your Subscription is Expiring Soon</h1>
    <p>Hi {{firstName}},</p>
    <p>Your {{planName}} subscription will expire on {{expirationDate}}.</p>
    <p><a href="{{renewLink}}">Renew Your Subscription</a></p>
  `,
    'payment_success': `
    <h1>Payment Received</h1>
    <p>Hi {{firstName}},</p>
    <p>We have successfully received your payment of {{amount}} {{currency}}.</p>
    <p>Invoice Number: {{invoiceNumber}}</p>
  `,
    'new_release': `
    <h1>New Content Available</h1>
    <p>Hi {{firstName}},</p>
    <p>Check out {{contentTitle}}, newly available on {{platformName}}!</p>
    <p><a href="{{contentLink}}">Watch Now</a></p>
  `,
    'recommendation': `
    <h1>Personalized Recommendations</h1>
    <p>Hi {{firstName}},</p>
    <p>Based on your viewing history, we think you'll enjoy:</p>
    <p>{{recommendations}}</p>
    <p><a href="{{recommendationLink}}">See More</a></p>
  `,
    'account_security': `
    <h1>Account Security Alert</h1>
    <p>Hi {{firstName}},</p>
    <p>We detected unusual activity on your account.</p>
    <p><a href="{{securityLink}}">Review Activity</a></p>
  `
};
const sendEmail = async (to, subject, templateId, templateData = {}) => {
    try {
        const template = emailTemplates[templateId];
        if (!template) {
            throw new Error(`Email template not found: ${templateId}`);
        }
        // Compile template
        const compiledTemplate = handlebars_1.default.compile(template);
        const htmlContent = compiledTemplate({
            platformName: 'OTT Platform',
            ...templateData
        });
        // Send email via SendGrid
        const msg = {
            to,
            from: process.env.SENDGRID_FROM_EMAIL || 'noreply@ottplatform.com',
            subject,
            html: htmlContent
        };
        const response = await mail_1.default.send(msg);
        logger_1.logger.info(`Email sent successfully to ${to}`, {
            templateId,
            messageId: response[0].headers['x-message-id']
        });
        return {
            success: true,
            externalId: response[0].headers['x-message-id']
        };
    }
    catch (error) {
        logger_1.logger.error(`Failed to send email to ${to}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
};
exports.sendEmail = sendEmail;
const sendBulkEmails = async (recipients, subject, templateId, templateData = {}) => {
    let success = 0;
    let failed = 0;
    const errors = [];
    for (const recipient of recipients) {
        const result = await (0, exports.sendEmail)(recipient, subject, templateId, templateData);
        if (result.success) {
            success++;
        }
        else {
            failed++;
            errors.push(`${recipient}: ${result.error}`);
        }
    }
    return { success, failed, errors };
};
exports.sendBulkEmails = sendBulkEmails;
//# sourceMappingURL=email.service.js.map
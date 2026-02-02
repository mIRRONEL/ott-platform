"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verificationSchema = exports.sendNotificationSchema = exports.preferencesSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.preferencesSchema = {
    body: joi_1.default.object({
        email: joi_1.default.object({
            newReleases: joi_1.default.boolean().optional(),
            subscriptionUpdates: joi_1.default.boolean().optional(),
            recommendations: joi_1.default.boolean().optional(),
            newsletter: joi_1.default.boolean().optional(),
            paymentReceipts: joi_1.default.boolean().optional(),
            securityAlerts: joi_1.default.boolean().optional()
        }).optional(),
        sms: joi_1.default.object({
            promotions: joi_1.default.boolean().optional(),
            accountUpdates: joi_1.default.boolean().optional(),
            verificationCodes: joi_1.default.boolean().optional()
        }).optional(),
        push: joi_1.default.object({
            newContent: joi_1.default.boolean().optional(),
            watchlistUpdates: joi_1.default.boolean().optional(),
            recommendations: joi_1.default.boolean().optional(),
            reminders: joi_1.default.boolean().optional()
        }).optional(),
        notificationFrequency: joi_1.default.string()
            .valid('immediate', 'daily', 'weekly', 'never')
            .optional()
    }).min(1)
};
exports.sendNotificationSchema = {
    body: joi_1.default.object({
        userId: joi_1.default.string().required(),
        type: joi_1.default.string()
            .valid('email', 'sms', 'push')
            .required(),
        templateId: joi_1.default.string().required(),
        subject: joi_1.default.string().max(255).optional(),
        recipient: joi_1.default.string().required(),
        templateData: joi_1.default.object().optional(),
        priority: joi_1.default.string()
            .valid('low', 'normal', 'high')
            .optional()
            .default('normal')
    })
};
exports.verificationSchema = {
    body: joi_1.default.object({
        userId: joi_1.default.string().required(),
        code: joi_1.default.string().length(6).required(),
        type: joi_1.default.string()
            .valid('email', 'phone')
            .required()
    })
};
//# sourceMappingURL=notification.schema.js.map
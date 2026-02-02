import Joi from 'joi';

export const preferencesSchema = {
  body: Joi.object({
    email: Joi.object({
      newReleases: Joi.boolean().optional(),
      subscriptionUpdates: Joi.boolean().optional(),
      recommendations: Joi.boolean().optional(),
      newsletter: Joi.boolean().optional(),
      paymentReceipts: Joi.boolean().optional(),
      securityAlerts: Joi.boolean().optional()
    }).optional(),
    sms: Joi.object({
      promotions: Joi.boolean().optional(),
      accountUpdates: Joi.boolean().optional(),
      verificationCodes: Joi.boolean().optional()
    }).optional(),
    push: Joi.object({
      newContent: Joi.boolean().optional(),
      watchlistUpdates: Joi.boolean().optional(),
      recommendations: Joi.boolean().optional(),
      reminders: Joi.boolean().optional()
    }).optional(),
    notificationFrequency: Joi.string()
      .valid('immediate', 'daily', 'weekly', 'never')
      .optional()
  }).min(1)
};

export const sendNotificationSchema = {
  body: Joi.object({
    userId: Joi.string().required(),
    type: Joi.string()
      .valid('email', 'sms', 'push')
      .required(),
    templateId: Joi.string().required(),
    subject: Joi.string().max(255).optional(),
    recipient: Joi.string().required(),
    templateData: Joi.object().optional(),
    priority: Joi.string()
      .valid('low', 'normal', 'high')
      .optional()
      .default('normal')
  })
};

export const verificationSchema = {
  body: Joi.object({
    userId: Joi.string().required(),
    code: Joi.string().length(6).required(),
    type: Joi.string()
      .valid('email', 'phone')
      .required()
  })
};

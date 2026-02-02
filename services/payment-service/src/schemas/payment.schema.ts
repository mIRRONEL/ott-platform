import Joi from 'joi';

export const subscriptionSchema = {
  body: Joi.object({
    userId: Joi.string().required(),
    planId: Joi.string().required(),
    paymentMethodId: Joi.string().required(),
    autoRenew: Joi.boolean().optional().default(true),
    billingCycle: Joi.string()
      .valid('monthly', 'quarterly', 'annual')
      .required()
  })
};

export const paymentSchema = {
  body: Joi.object({
    userId: Joi.string().required(),
    amount: Joi.number().required().positive(),
    currency: Joi.string().length(3).required(),
    paymentMethodId: Joi.string().required(),
    description: Joi.string().max(500).optional(),
    metadata: Joi.object().optional()
  })
};

export const paymentMethodSchema = {
  body: Joi.object({
    cardNumber: Joi.string()
      .creditCard()
      .optional(),
    expiryMonth: Joi.number().min(1).max(12).optional(),
    expiryYear: Joi.number().min(2023).optional(),
    cvv: Joi.string().length(3).optional(),
    billingName: Joi.string().max(100).optional(),
    billingEmail: Joi.string().email().optional(),
    billingAddress: Joi.string().max(255).optional(),
    isDefault: Joi.boolean().optional()
  }).min(1)
};

export const planSchema = {
  name: Joi.string().required().max(50),
  description: Joi.string().required().max(500),
  price: Joi.number().required().positive(),
  currency: Joi.string().length(3).required(),
  billingCycle: Joi.string()
    .valid('monthly', 'quarterly', 'annual')
    .required(),
  features: Joi.array()
    .items(Joi.string())
    .required(),
  maxDevices: Joi.number().required().positive(),
  maxResolution: Joi.string()
    .valid('360p', '480p', '720p', '1080p', '4k')
    .required(),
  adSupported: Joi.boolean().required(),
  downloadAllowed: Joi.boolean().required()
};

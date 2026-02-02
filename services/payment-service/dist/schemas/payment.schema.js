"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.planSchema = exports.paymentMethodSchema = exports.paymentSchema = exports.subscriptionSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.subscriptionSchema = {
    body: joi_1.default.object({
        userId: joi_1.default.string().required(),
        planId: joi_1.default.string().required(),
        paymentMethodId: joi_1.default.string().required(),
        autoRenew: joi_1.default.boolean().optional().default(true),
        billingCycle: joi_1.default.string()
            .valid('monthly', 'quarterly', 'annual')
            .required()
    })
};
exports.paymentSchema = {
    body: joi_1.default.object({
        userId: joi_1.default.string().required(),
        amount: joi_1.default.number().required().positive(),
        currency: joi_1.default.string().length(3).required(),
        paymentMethodId: joi_1.default.string().required(),
        description: joi_1.default.string().max(500).optional(),
        metadata: joi_1.default.object().optional()
    })
};
exports.paymentMethodSchema = {
    body: joi_1.default.object({
        cardNumber: joi_1.default.string()
            .creditCard()
            .optional(),
        expiryMonth: joi_1.default.number().min(1).max(12).optional(),
        expiryYear: joi_1.default.number().min(2023).optional(),
        cvv: joi_1.default.string().length(3).optional(),
        billingName: joi_1.default.string().max(100).optional(),
        billingEmail: joi_1.default.string().email().optional(),
        billingAddress: joi_1.default.string().max(255).optional(),
        isDefault: joi_1.default.boolean().optional()
    }).min(1)
};
exports.planSchema = {
    name: joi_1.default.string().required().max(50),
    description: joi_1.default.string().required().max(500),
    price: joi_1.default.number().required().positive(),
    currency: joi_1.default.string().length(3).required(),
    billingCycle: joi_1.default.string()
        .valid('monthly', 'quarterly', 'annual')
        .required(),
    features: joi_1.default.array()
        .items(joi_1.default.string())
        .required(),
    maxDevices: joi_1.default.number().required().positive(),
    maxResolution: joi_1.default.string()
        .valid('360p', '480p', '720p', '1080p', '4k')
        .required(),
    adSupported: joi_1.default.boolean().required(),
    downloadAllowed: joi_1.default.boolean().required()
};
//# sourceMappingURL=payment.schema.js.map
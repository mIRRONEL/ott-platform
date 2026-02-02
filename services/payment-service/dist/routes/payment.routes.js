"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payment_controller_1 = require("../controllers/payment.controller");
const validation_1 = require("../middleware/validation");
const payment_schema_1 = require("../schemas/payment.schema");
const router = (0, express_1.Router)();
/**
 * @route GET /api/payments/plans
 * @description Get all subscription plans
 * @access Public
 */
router.get('/plans', payment_controller_1.getSubscriptionPlans);
/**
 * @route POST /api/payments/subscribe
 * @description Create new subscription
 * @access Private
 */
router.post('/subscribe', (0, validation_1.validateRequest)(payment_schema_1.subscriptionSchema), payment_controller_1.createSubscription);
/**
 * @route PUT /api/payments/subscriptions/:subscriptionId
 * @description Update subscription plan
 * @access Private
 */
router.put('/subscriptions/:subscriptionId', (0, validation_1.validateRequest)(payment_schema_1.subscriptionSchema), payment_controller_1.updateSubscription);
/**
 * @route POST /api/payments/subscriptions/:subscriptionId/cancel
 * @description Cancel subscription
 * @access Private
 */
router.post('/subscriptions/:subscriptionId/cancel', payment_controller_1.cancelSubscription);
/**
 * @route GET /api/payments/history/:userId
 * @description Get payment history
 * @access Private
 */
router.get('/history/:userId', payment_controller_1.getPaymentHistory);
/**
 * @route POST /api/payments/process
 * @description Process payment
 * @access Private
 */
router.post('/process', (0, validation_1.validateRequest)(payment_schema_1.paymentSchema), payment_controller_1.processPayment);
/**
 * @route GET /api/payments/invoice/:invoiceId
 * @description Get invoice details
 * @access Private
 */
router.get('/invoice/:invoiceId', payment_controller_1.getInvoice);
/**
 * @route PUT /api/payments/payment-methods/:methodId
 * @description Update payment method
 * @access Private
 */
router.put('/payment-methods/:methodId', (0, validation_1.validateRequest)(payment_schema_1.paymentMethodSchema), payment_controller_1.updatePaymentMethod);
/**
 * @route GET /api/payments/payment-methods/:userId
 * @description Get user payment methods
 * @access Private
 */
router.get('/payment-methods/:userId', payment_controller_1.getPaymentMethods);
exports.default = router;
//# sourceMappingURL=payment.routes.js.map
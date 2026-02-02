import { Router, Request, Response, NextFunction } from 'express';
import {
  getSubscriptionPlans,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  getPaymentHistory,
  processPayment,
  getInvoice,
  updatePaymentMethod,
  getPaymentMethods
} from '../controllers/payment.controller';
import { validateRequest } from '../middleware/validation';
import {
  subscriptionSchema,
  paymentSchema,
  paymentMethodSchema
} from '../schemas/payment.schema';

const router = Router();

/**
 * @route GET /api/payments/plans
 * @description Get all subscription plans
 * @access Public
 */
router.get('/plans', getSubscriptionPlans);

/**
 * @route POST /api/payments/subscribe
 * @description Create new subscription
 * @access Private
 */
router.post('/subscribe', validateRequest(subscriptionSchema), createSubscription);

/**
 * @route PUT /api/payments/subscriptions/:subscriptionId
 * @description Update subscription plan
 * @access Private
 */
router.put('/subscriptions/:subscriptionId', validateRequest(subscriptionSchema), updateSubscription);

/**
 * @route POST /api/payments/subscriptions/:subscriptionId/cancel
 * @description Cancel subscription
 * @access Private
 */
router.post('/subscriptions/:subscriptionId/cancel', cancelSubscription);

/**
 * @route GET /api/payments/history/:userId
 * @description Get payment history
 * @access Private
 */
router.get('/history/:userId', getPaymentHistory);

/**
 * @route POST /api/payments/process
 * @description Process payment
 * @access Private
 */
router.post('/process', validateRequest(paymentSchema), processPayment);

/**
 * @route GET /api/payments/invoice/:invoiceId
 * @description Get invoice details
 * @access Private
 */
router.get('/invoice/:invoiceId', getInvoice);

/**
 * @route PUT /api/payments/payment-methods/:methodId
 * @description Update payment method
 * @access Private
 */
router.put('/payment-methods/:methodId', validateRequest(paymentMethodSchema), updatePaymentMethod);

/**
 * @route GET /api/payments/payment-methods/:userId
 * @description Get user payment methods
 * @access Private
 */
router.get('/payment-methods/:userId', getPaymentMethods);

export default router;

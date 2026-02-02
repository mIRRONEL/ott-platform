import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';
import { pool } from '../database/connection';
import { kafkaProducer } from '../kafka/producer';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError, DatabaseError } from '../utils/errors';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-08-16'
});

/**
 * Get all subscription plans
 */
export const getSubscriptionPlans = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check cache
    const cachedPlans = await redisClient.get('subscription_plans');
    if (cachedPlans) {
      logger.info('Subscription plans retrieved from cache');
      res.status(200).json({
        status: 'success',
        data: JSON.parse(cachedPlans),
        source: 'cache'
      });
      return;
    }

    const query = `
      SELECT 
        id,
        name,
        description,
        price,
        currency,
        billing_cycle,
        features,
        max_devices,
        max_resolution,
        ad_supported,
        download_allowed,
        created_at,
        is_active
      FROM subscription_plans
      WHERE is_active = true
      ORDER BY price ASC
    `;

    const result = await pool.query(query);

    // Cache for 24 hours
    await redisClient.setEx(
      'subscription_plans',
      86400,
      JSON.stringify(result.rows)
    );

    logger.info(`Subscription plans retrieved: ${result.rows.length}`);

    res.status(200).json({
      status: 'success',
      data: result.rows,
      source: 'database'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new subscription
 */
export const createSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId, planId, paymentMethodId, autoRenew, billingCycle } = req.body;
    const subscriptionId = uuidv4();

    // Get plan details
    const planQuery = 'SELECT * FROM subscription_plans WHERE id = $1';
    const planResult = await pool.query(planQuery, [planId]);

    if (planResult.rows.length === 0) {
      throw new NotFoundError('Subscription plan not found');
    }

    const plan = planResult.rows[0];

    // Create Stripe subscription
    const stripeSubscription = await stripe.subscriptions.create({
      customer: await getOrCreateStripeCustomer(userId),
      items: [{ price: plan.stripe_price_id }],
      default_payment_method: paymentMethodId,
      metadata: { userId, planId }
    });

    // Create subscription in database
    const subscriptionQuery = `
      INSERT INTO subscriptions (id, user_id, plan_id, stripe_subscription_id, status, current_period_start, current_period_end, auto_renew, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `;

    const subscription = await pool.query(subscriptionQuery, [
      subscriptionId,
      userId,
      planId,
      stripeSubscription.id,
      'active',
      new Date(stripeSubscription.current_period_start * 1000),
      new Date(stripeSubscription.current_period_end * 1000),
      autoRenew
    ]);

    // Publish Kafka event
    await kafkaProducer.send({
      topic: 'subscription.created',
      messages: [
        {
          key: userId,
          value: JSON.stringify({
            userId,
            subscriptionId,
            planId,
            planName: plan.name,
            amount: plan.price,
            currency: plan.currency,
            billingCycle,
            timestamp: new Date().toISOString(),
            eventId: `${subscriptionId}-${Date.now()}`
          })
        }
      ]
    });

    logger.info(`Subscription created: ${subscriptionId} - User: ${userId} - Plan: ${planId}`);

    res.status(201).json({
      status: 'success',
      message: 'Subscription created successfully',
      data: subscription.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update subscription
 */
export const updateSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { subscriptionId } = req.params;
    const { planId } = req.body;

    // Get current subscription
    const subQuery = 'SELECT * FROM subscriptions WHERE id = $1';
    const subResult = await pool.query(subQuery, [subscriptionId]);

    if (subResult.rows.length === 0) {
      throw new NotFoundError('Subscription not found');
    }

    const currentSub = subResult.rows[0];

    // Get new plan
    const planQuery = 'SELECT * FROM subscription_plans WHERE id = $1';
    const planResult = await pool.query(planQuery, [planId]);

    if (planResult.rows.length === 0) {
      throw new NotFoundError('Subscription plan not found');
    }

    const newPlan = planResult.rows[0];

    // Update in Stripe
    await stripe.subscriptions.update(currentSub.stripe_subscription_id, {
      items: [
        {
          id: (await stripe.subscriptions.retrieve(currentSub.stripe_subscription_id)).items.data[0].id,
          price: newPlan.stripe_price_id
        }
      ]
    });

    // Update in database
    const updateQuery = `
      UPDATE subscriptions
      SET plan_id = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [planId, subscriptionId]);

    // Publish Kafka event
    await kafkaProducer.send({
      topic: 'subscription.updated',
      messages: [
        {
          key: currentSub.user_id,
          value: JSON.stringify({
            userId: currentSub.user_id,
            subscriptionId,
            oldPlanId: currentSub.plan_id,
            newPlanId: planId,
            timestamp: new Date().toISOString()
          })
        }
      ]
    });

    logger.info(`Subscription updated: ${subscriptionId}`);

    res.status(200).json({
      status: 'success',
      message: 'Subscription updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { subscriptionId } = req.params;

    // Get subscription
    const query = 'SELECT * FROM subscriptions WHERE id = $1';
    const result = await pool.query(query, [subscriptionId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Subscription not found');
    }

    const subscription = result.rows[0];

    // Cancel in Stripe
    await stripe.subscriptions.update(subscription.stripe_subscription_id, { cancel_at_period_end: true });

    // Update in database
    const updateQuery = `
      UPDATE subscriptions
      SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, [subscriptionId]);

    // Publish Kafka event
    await kafkaProducer.send({
      topic: 'subscription.cancelled',
      messages: [
        {
          key: subscription.user_id,
          value: JSON.stringify({
            userId: subscription.user_id,
            subscriptionId,
            reason: 'user_request',
            timestamp: new Date().toISOString()
          })
        }
      ]
    });

    logger.info(`Subscription cancelled: ${subscriptionId}`);

    res.status(200).json({
      status: 'success',
      message: 'Subscription cancelled successfully',
      data: updateResult.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment history
 */
export const getPaymentHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const query = `
      SELECT 
        id,
        user_id,
        amount,
        currency,
        status,
        description,
        stripe_payment_id,
        created_at
      FROM payments
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = 'SELECT COUNT(*) FROM payments WHERE user_id = $1';
    const countResult = await pool.query(countQuery, [userId]);
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(query, [
      userId,
      Number(limit),
      (Number(page) - 1) * Number(limit)
    ]);

    logger.info(`Payment history retrieved: ${userId}`);

    res.status(200).json({
      status: 'success',
      data: result.rows,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process payment
 */
export const processPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      userId,
      amount,
      currency,
      paymentMethodId,
      description,
      metadata
    } = req.body;

    const paymentId = uuidv4();

    // Get or create Stripe customer
    const stripeCustomerId = await getOrCreateStripeCustomer(userId);

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      confirm: true,
      metadata: {
        paymentId,
        userId,
        ...metadata
      }
    });

    // Record in database
    const insertQuery = `
      INSERT INTO payments (id, user_id, amount, currency, status, description, stripe_payment_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;

    const paymentStatus = paymentIntent.status === 'succeeded' ? 'completed' : 'pending';

    const result = await pool.query(insertQuery, [
      paymentId,
      userId,
      amount,
      currency,
      paymentStatus,
      description,
      paymentIntent.id
    ]);

    // Publish Kafka event
    const topic = paymentIntent.status === 'succeeded' ? 'payment.success' : 'payment.failed';
    
    await kafkaProducer.send({
      topic,
      messages: [
        {
          key: userId,
          value: JSON.stringify({
            userId,
            paymentId,
            amount,
            currency,
            status: paymentStatus,
            stripePaymentId: paymentIntent.id,
            timestamp: new Date().toISOString()
          })
        }
      ]
    });

    logger.info(`Payment processed: ${paymentId} - User: ${userId} - Amount: ${amount} ${currency}`);

    res.status(201).json({
      status: 'success',
      message: 'Payment processed successfully',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get invoice
 */
export const getInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { invoiceId } = req.params;

    const query = `
      SELECT 
        id,
        user_id,
        subscription_id,
        amount,
        currency,
        status,
        invoice_number,
        issued_at,
        due_date,
        paid_at,
        stripe_invoice_id
      FROM invoices
      WHERE id = $1
    `;

    const result = await pool.query(query, [invoiceId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Invoice not found');
    }

    logger.info(`Invoice retrieved: ${invoiceId}`);

    res.status(200).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update payment method
 */
export const updatePaymentMethod = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { methodId } = req.params;
    const { isDefault } = req.body;

    const query = `
      UPDATE payment_methods
      SET is_default = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [isDefault, methodId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Payment method not found');
    }

    logger.info(`Payment method updated: ${methodId}`);

    res.status(200).json({
      status: 'success',
      message: 'Payment method updated',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment methods
 */
export const getPaymentMethods = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    const query = `
      SELECT 
        id,
        user_id,
        card_last_four,
        card_brand,
        expiry_month,
        expiry_year,
        is_default,
        created_at
      FROM payment_methods
      WHERE user_id = $1
      ORDER BY is_default DESC, created_at DESC
    `;

    const result = await pool.query(query, [userId]);

    logger.info(`Payment methods retrieved: ${userId}`);

    res.status(200).json({
      status: 'success',
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

// Helper functions

async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const query = 'SELECT stripe_customer_id FROM users WHERE id = $1';
  const result = await pool.query(query, [userId]);

  if (result.rows.length > 0 && result.rows[0].stripe_customer_id) {
    return result.rows[0].stripe_customer_id;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    metadata: { userId }
  });

  // Update user with Stripe customer ID
  const updateQuery = 'UPDATE users SET stripe_customer_id = $1 WHERE id = $2';
  await pool.query(updateQuery, [customer.id, userId]);

  return customer.id;
}

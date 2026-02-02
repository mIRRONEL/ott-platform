import twilio from 'twilio';
import { logger } from '../utils/logger';

// Lazy-initialize Twilio client only when needed
let twilioClient: any = null;

const getTwilioClient = () => {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || 'mock-sid';
    const authToken = process.env.TWILIO_AUTH_TOKEN || 'mock-token';
    
    if (!accountSid || !authToken || accountSid === 'mock-sid') {
      logger.warn('Twilio credentials not configured, SMS service unavailable');
      return null;
    }
    
    try {
      twilioClient = twilio(accountSid, authToken);
    } catch (err) {
      logger.error('Failed to initialize Twilio client:', err);
      return null;
    }
  }
  return twilioClient;
};

const smsTemplates: any = {
  'verification_code': `Your {{platformName}} verification code is: {{code}}. Do not share this code with anyone.`,
  'password_reset': `Reset your {{platformName}} password: {{resetLink}}. Link expires in 1 hour.`,
  'subscription_alert': `Your {{platformName}} subscription {{status}}. Amount: {{amount}} {{currency}}.`,
  'payment_reminder': `Reminder: Your {{platformName}} payment of {{amount}} {{currency}} is due on {{dueDate}}.`,
  'security_alert': `Security alert on your {{platformName}} account. If this wasn't you, change your password immediately.`,
  'promotion': `{{promotionName}}: {{description}} Valid until {{expirationDate}}. {{promotionLink}}`
};

export const sendSMS = async (
  phoneNumber: string,
  templateId: string,
  templateData: any = {}
): Promise<{ success: boolean; externalId?: string; error?: string }> => {
  try {
    const client = getTwilioClient();
    if (!client) {
      logger.warn(`SMS service not available for ${phoneNumber}`);
      return { success: false, error: 'SMS service not configured' };
    }

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
    const response = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
      to: phoneNumber
    });

    logger.info(`SMS sent successfully to ${phoneNumber}`, {
      templateId,
      messageSid: response.sid
    });

    return {
      success: true,
      externalId: response.sid
    };
  } catch (error) {
    logger.error(`Failed to send SMS to ${phoneNumber}:`, error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
};

export const sendBulkSMS = async (
  phoneNumbers: string[],
  templateId: string,
  templateData: any = {}
): Promise<{ success: number; failed: number; errors: string[] }> => {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const phoneNumber of phoneNumbers) {
    const result = await sendSMS(phoneNumber, templateId, templateData);
    if (result.success) {
      success++;
    } else {
      failed++;
      errors.push(`${phoneNumber}: ${result.error}`);
    }
  }

  return { success, failed, errors };
};

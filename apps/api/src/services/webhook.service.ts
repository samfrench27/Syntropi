// apps/api/src/services/webhook.service.ts
import axios from 'axios';
import { createError } from '../middleware/errorHandler';
import { winstonLogger as logger } from '../utils/logger';

// Token.io API configuration
const TOKEN_API_BASE = process.env.TOKEN_API_BASE_URL || 'https://api.sandbox.token.io';
const TOKEN_API_KEY = process.env.TOKEN_API_KEY || 'bS0zY25ia2M5NlR5MWlQQlhSTWZEU2pidTM5SlAzLTV6S3RYRUFxOmFlNjJjNmRkLWY0YjItNDQ5MC1iMGNkLTgyZGFkZWFlMDMzYQ==';

// Webhook configuration for Token.io
interface TokenWebhookConfig {
  url: string;
  events: string[];
}

// Default webhook configuration
const DEFAULT_WEBHOOK_CONFIG: TokenWebhookConfig = {
  url: `${process.env.API_BASE_URL || 'https://api-staging.syntropi.co.uk'}/api/webhooks/token`,
  events: [
    'payment.status_changed',
    'payment.completed',
    'payment.failed',
    'payment.cancelled',
    'payment.expired'
  ]
};

// Register webhook with Token.io
export const registerTokenWebhook = async (webhookUrl?: string): Promise<void> => {
  try {
    if (!TOKEN_API_KEY) {
      throw createError('Token.io API key not configured', 500);
    }

    const config: TokenWebhookConfig = {
      ...DEFAULT_WEBHOOK_CONFIG,
      ...(webhookUrl && { url: webhookUrl })
    };

    logger.info('Registering webhook with Token.io:', {
      url: config.url,
      events: config.events
    });

    const response = await axios.put(
      `${TOKEN_API_BASE}/webhook/config`,
      config,
      {
        headers: {
          'Authorization': `Basic ${TOKEN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info('Webhook registered successfully with Token.io:', {
      status: response.status,
      webhookUrl: config.url
    });

  } catch (error: any) {
    logger.error('Error registering webhook with Token.io:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      error: error.message
    });

    // Don't throw error to prevent startup failures
    // Webhooks can be registered manually if needed
    logger.warn('Continuing without webhook registration - webhooks can be configured manually');
  }
};

// Get current webhook configuration from Token.io
export const getTokenWebhookConfig = async (): Promise<TokenWebhookConfig | null> => {
  try {
    if (!TOKEN_API_KEY) {
      throw createError('Token.io API key not configured', 500);
    }

    const response = await axios.get(
      `${TOKEN_API_BASE}/webhook/config`,
      {
        headers: {
          'Authorization': `Basic ${TOKEN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info('Retrieved webhook config from Token.io:', response.data);
    return response.data;

  } catch (error: any) {
    logger.error('Error getting webhook config from Token.io:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      error: error.message
    });

    return null;
  }
};

// Remove webhook configuration from Token.io
export const removeTokenWebhook = async (): Promise<void> => {
  try {
    if (!TOKEN_API_KEY) {
      throw createError('Token.io API key not configured', 500);
    }

    await axios.delete(
      `${TOKEN_API_BASE}/webhook/config`,
      {
        headers: {
          'Authorization': `Basic ${TOKEN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info('Webhook removed from Token.io');

  } catch (error: any) {
    logger.error('Error removing webhook from Token.io:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      error: error.message
    });

    throw createError(`Failed to remove webhook: ${error.message}`, 500);
  }
};

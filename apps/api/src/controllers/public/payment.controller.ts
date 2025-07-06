// apps/api/src/controllers/public/payment.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as paymentService from '../../services/payment.service';
import { createError } from '../../middleware/errorHandler';
import { PaymentFlowType } from '../../models/payment.model';
import { winstonLogger as logger } from '../../utils/logger';

// Helper function to simplify payment data for client response
const simplifyPaymentData = (payment: any) => {
  return {
    paymentId: payment.paymentId,
    status: payment.status,
    provider: payment.provider,
    bankId: payment.bankId,
    amount: payment.amount,
    fromAccount: payment.fromAccount,
    toAccount: payment.toAccount,
    reference: payment.reference,
    flowType: payment.flowType,
    clientRedirectUrl: payment.redirectUrl, // Client's callback URL
    authenticationUrl: payment.providerData?.redirectUrl, // Token.io's auth URL
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    expiresAt: payment.expiresAt,
    completedAt: payment.completedAt,
    statusHistory: payment.statusHistory
  };
};

// Create a new payment
export const createPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      fromAccount,
      toAccount,
      amount,
      reference,
      flowType,
      redirectUrl,
      provider,
      bankId
    } = req.body;

    // Extract client info from API key authentication
    const apiKey = (req as any).apiKey;
    
    if (!apiKey || !apiKey.organizationId) {
      return next(createError('API key authentication required', 401));
    }

    // Use API key ID as client ID and get organization ID
    const clientId = apiKey.id;
    const organizationId = apiKey.organizationId;

    // Validate required fields
    if (!toAccount) {
      return next(createError('toAccount is required', 400));
    }
    if (!amount || !amount.value || !amount.currency) {
      return next(createError('amount with value and currency is required', 400));
    }
    if (!provider) {
      return next(createError('provider is required', 400));
    }

    // Create payment request
    const paymentRequest: paymentService.CreatePaymentRequest = {
      clientId,
      organizationId,
      fromAccount,
      toAccount,
      amount,
      reference,
      flowType: flowType || PaymentFlowType.API_ONLY,
      redirectUrl,
      provider,
      bankId
    };

    const paymentResponse = await paymentService.createPayment(paymentRequest);

    logger.info('Payment created via API:', {
      paymentId: paymentResponse.paymentId,
      clientId,
      provider,
      amount: amount.value + ' ' + amount.currency
    });

    res.status(201).json({
      success: true,
      data: paymentResponse
    });

  } catch (error) {
    logger.error('Error in createPayment controller:', error);
    next(error);
  }
};

// Get a specific payment
export const getPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentId } = req.params;
    const apiKey = (req as any).apiKey;

    if (!apiKey || !apiKey.organizationId) {
      return next(createError('API key authentication required', 401));
    }

    const clientId = apiKey.id;

    const payment = await paymentService.getPayment(paymentId, clientId);
    const simplifiedPayment = simplifyPaymentData(payment);

    res.json({
      success: true,
      data: simplifiedPayment
    });

  } catch (error) {
    logger.error('Error in getPayment controller:', error);
    next(error);
  }
};

// Get payments for the authenticated client
export const getPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = (req as any).apiKey;

    if (!apiKey || !apiKey.organizationId) {
      return next(createError('API key authentication required', 401));
    }

    const clientId = apiKey.id;

    const { status, provider, limit, offset } = req.query;

    const options = {
      status: status as any,
      provider: provider as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined
    };

    const result = await paymentService.getPayments(clientId, options);
    const simplifiedPayments = result.payments.map(simplifyPaymentData);

    res.json({
      success: true,
      data: {
        payments: simplifiedPayments,
        total: result.total,
        limit: options.limit || 20,
        offset: options.offset || 0
      }
    });

  } catch (error) {
    logger.error('Error in getPayments controller:', error);
    next(error);
  }
};

// Cancel a payment
export const cancelPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentId } = req.params;
    const apiKey = (req as any).apiKey;

    if (!apiKey || !apiKey.organizationId) {
      return next(createError('API key authentication required', 401));
    }

    const clientId = apiKey.id;

    const payment = await paymentService.cancelPayment(paymentId, clientId);
    const simplifiedPayment = simplifyPaymentData(payment);

    logger.info('Payment cancelled via API:', {
      paymentId,
      clientId
    });

    res.json({
      success: true,
      data: simplifiedPayment
    });

  } catch (error) {
    logger.error('Error in cancelPayment controller:', error);
    next(error);
  }
};

// Sync payment status with provider
export const syncPaymentStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentId } = req.params;
    const apiKey = (req as any).apiKey;

    if (!apiKey || !apiKey.organizationId) {
      return next(createError('API key authentication required', 401));
    }

    const clientId = apiKey.id;

    // First verify the payment belongs to the client
    await paymentService.getPayment(paymentId, clientId);
    
    // Then sync the status
    const payment = await paymentService.syncPaymentStatus(paymentId);
    const simplifiedPayment = simplifyPaymentData(payment);

    res.json({
      success: true,
      data: simplifiedPayment
    });

  } catch (error) {
    logger.error('Error in syncPaymentStatus controller:', error);
    next(error);
  }
};

// Get supported payment providers
export const getSupportedProviders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const providers = paymentService.getSupportedProviders();

    res.json({
      success: true,
      data: {
        providers: providers.map(provider => ({
          id: provider,
          name: provider,
          supportsPayments: true
        }))
      }
    });

  } catch (error) {
    logger.error('Error in getSupportedProviders controller:', error);
    next(error);
  }
};

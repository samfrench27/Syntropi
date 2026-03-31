// apps/api/src/controllers/public/payment.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as paymentService from '../../services/payment.service';
import { createError } from '../../middleware/errorHandler';
import { PaymentFlowType } from '../../models/payment.model';
import { winstonLogger as logger } from '../../utils/logger';
import { generateHostedPageUrl } from '../../utils/jwt';
import { PaymentTokenRequest } from '../../middleware/paymentTokenAuth';

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
    redirectUrl: payment.redirectUrl, // Token.io's auth URL
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

    // Generate hosted page URL with access token if flowType is HOSTED_PAGES
    let hostedPageUrl = null;
    if (flowType === PaymentFlowType.HOSTED_PAGES || flowType === PaymentFlowType.EMBEDDED_HOSTED_PAGES) {
      hostedPageUrl = generateHostedPageUrl(
        paymentResponse.paymentId,
        organizationId,
        clientId,
        redirectUrl
      );
    }

    // Transform to match PaymentResponse schema (not PaymentDetail)
    const responseData = {
      paymentId: paymentResponse.paymentId,
      status: paymentResponse.status,
      redirectUrl: paymentResponse.redirectUrl || null, // Token.io auth URL
      hostedPageUrl, // New: URL to hosted payment pages with embedded token
      provider: paymentResponse.provider,
      bankId: paymentResponse.bankId,
      amount: paymentResponse.amount,
      createdAt: paymentResponse.createdAt,
      expiresAt: paymentResponse.expiresAt
    };

    res.status(201).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    logger.error('Error in createPayment controller:', error);
    next(error);
  }
};

// Get a specific payment
export const getPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paymentId = Array.isArray(req.params.paymentId) ? req.params.paymentId[0] : req.params.paymentId;
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
    const paymentId = Array.isArray(req.params.paymentId) ? req.params.paymentId[0] : req.params.paymentId;
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
    const paymentId = Array.isArray(req.params.paymentId) ? req.params.paymentId[0] : req.params.paymentId;
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

// Get a specific payment for hosted pages (using payment token authentication)
export const getPaymentForHostedPages = async (req: PaymentTokenRequest, res: Response, next: NextFunction) => {
  try {
    const { paymentId } = req.params;
    const paymentToken = req.paymentToken;

    if (!paymentToken) {
      return next(createError('Payment token authentication required', 401));
    }

    // Verify token is for the requested payment
    if (paymentToken.paymentId !== paymentId) {
      return next(createError('Token is not valid for this payment', 403));
    }

    // Get payment using organization and client from token
    const payment = await paymentService.getPayment(paymentId, paymentToken.clientId);
    
    // Return payment data formatted for hosted pages
    const hostedPagePayment = {
      paymentId: payment.paymentId,
      status: payment.status,
      amount: payment.amount,
      reference: payment.reference,
      description: payment.reference, // Use reference as description for now
      toAccount: {
        accountName: payment.toAccount.accountName,
        accountNumber: payment.toAccount.accountNumber,
        sortCode: payment.toAccount.sortCode
      },
      fromAccount: payment.fromAccount ? {
        accountName: payment.fromAccount.accountName,
        accountNumber: payment.fromAccount.accountNumber,
        sortCode: payment.fromAccount.sortCode
      } : undefined,
      merchant: {
        name: paymentToken.organizationId, // You might want to fetch actual org name
        logo: undefined,
        redirectUri: payment.redirectUrl
      },
      createdAt: payment.createdAt,
      expiresAt: payment.expiresAt
    };

    res.json({
      success: true,
      data: hostedPagePayment
    });

    logger.info('Payment accessed via hosted pages:', {
      paymentId,
      organizationId: paymentToken.organizationId
    });

  } catch (error) {
    logger.error('Error in getPaymentForHostedPages controller:', error);
    next(error);
  }
};

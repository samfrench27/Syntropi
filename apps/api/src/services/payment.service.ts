// apps/api/src/services/payment.service.ts
import { Payment, IPayment, PaymentStatus, PaymentFlowType } from '../models/payment.model';
import { createError } from '../middleware/errorHandler';
import { winstonLogger as logger } from '../utils/logger';
import * as tokenPaymentAdapter from '../integrations/adapters/token-payment-adapter';
import { v4 as uuidv4 } from 'uuid';

// Payment creation request interface
export interface CreatePaymentRequest {
  // Client information
  clientId: string;
  organizationId: string;
  
  // Payment details
  fromAccount?: {
    accountNumber?: string;
    sortCode?: string;
    iban?: string;
    bic?: string;
    accountName: string;
    bankName?: string;
  };
  toAccount: {
    accountNumber?: string;
    sortCode?: string;
    iban?: string;
    bic?: string;
    accountName: string;
    bankName?: string;
  };
  amount: {
    value: string;
    currency: string;
  };
  reference?: {
    reference?: string;
    endToEndId?: string;
  };
  
  // Flow configuration
  flowType?: PaymentFlowType;
  redirectUrl?: string;
  
  // Provider selection
  provider: string;
  bankId?: string;
}

// Payment response interface
export interface PaymentResponse {
  paymentId: string;
  status: PaymentStatus;
  redirectUrl?: string;
  provider: string;
  bankId?: string;
  amount: {
    value: string;
    currency: string;
  };
  createdAt: Date;
  expiresAt?: Date;
}

// Get the appropriate payment adapter for a provider
const getPaymentAdapter = (provider: string) => {
  switch (provider) {
    case 'token':
      return tokenPaymentAdapter;
    // Future adapters for other providers
    // case 'yapily':
    //   return yapilyPaymentAdapter;
    // case 'truelayer':
    //   return truelayerPaymentAdapter;
    default:
      throw createError(`Payment provider not supported: ${provider}`, 400);
  }
};

// Generate a unique payment ID
const generatePaymentId = (): string => {
  return `pay_${uuidv4().replace(/-/g, '')}`;
};

// Validate payment request
const validatePaymentRequest = (request: CreatePaymentRequest): void => {
  // Validate required fields
  if (!request.clientId) {
    throw createError('clientId is required', 400);
  }
  if (!request.organizationId) {
    throw createError('organizationId is required', 400);
  }
  if (!request.toAccount) {
    throw createError('toAccount is required', 400);
  }
  if (!request.toAccount.accountName) {
    throw createError('toAccount.accountName is required', 400);
  }
  if (!request.amount || !request.amount.value || !request.amount.currency) {
    throw createError('amount.value and amount.currency are required', 400);
  }
  if (!request.provider) {
    throw createError('provider is required', 400);
  }

  // Validate amount format
  const amountValue = parseFloat(request.amount.value);
  if (isNaN(amountValue) || amountValue <= 0) {
    throw createError('amount.value must be a positive number', 400);
  }

  // Validate account details
  const { toAccount } = request;
  const hasSepaDetails = toAccount.iban;
  const hasFasterPaymentsDetails = toAccount.sortCode && toAccount.accountNumber;
  
  if (!hasSepaDetails && !hasFasterPaymentsDetails) {
    throw createError('toAccount must have either IBAN or sortCode+accountNumber', 400);
  }

  // Validate flow type requirements
  if (request.flowType === PaymentFlowType.EMBEDDED_HOSTED_PAGES && !request.bankId) {
    throw createError('bankId is required when flowType is EMBEDDED_HOSTED_PAGES', 400);
  }
};

// Create a new payment
export const createPayment = async (request: CreatePaymentRequest): Promise<PaymentResponse> => {
  try {
    // Validate request
    validatePaymentRequest(request);
    
    // Generate payment ID
    const paymentId = generatePaymentId();
    
    // Set expiration (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    // Create payment document
    const paymentData: any = {
      paymentId,
      clientId: request.clientId,
      organizationId: request.organizationId,
      toAccount: request.toAccount,
      amount: request.amount,
      reference: request.reference || {},
      flowType: request.flowType || PaymentFlowType.API_ONLY,
      redirectUrl: request.redirectUrl,
      status: PaymentStatus.PENDING,
      provider: request.provider,
      bankId: request.bankId,
      providerData: {
        provider: request.provider
      },
      expiresAt
    };

    // Only include fromAccount if it's provided
    if (request.fromAccount) {
      paymentData.fromAccount = request.fromAccount;
    }

    const payment = new Payment(paymentData);

    // Save payment to database first
    await payment.save();
    
    logger.info('Payment created in database:', {
      paymentId,
      clientId: request.clientId,
      provider: request.provider,
      amount: request.amount
    });

    // Get provider adapter and create payment
    const adapter = getPaymentAdapter(request.provider);
    const providerResult = await adapter.createPayment(payment);
    
    // Update payment with provider response
    payment.providerData = {
      ...payment.providerData,
      originalPaymentId: providerResult.tokenPaymentId,
      redirectUrl: providerResult.redirectUrl,
      bankId: request.bankId
    };
    
    // Update status if different
    if (providerResult.status !== payment.status) {
      payment.status = providerResult.status;
      payment.statusHistory.push({
        status: providerResult.status,
        timestamp: new Date(),
        provider: payment.provider,
        details: 'Status updated from provider'
      });
    }
    
    await payment.save();
    
    logger.info('Payment created with provider:', {
      paymentId,
      provider: request.provider,
      providerPaymentId: providerResult.tokenPaymentId,
      status: providerResult.status,
      flowType: request.flowType,
      providerRedirectUrl: providerResult.redirectUrl,
      clientRedirectUrl: payment.redirectUrl,
      finalRedirectUrl: providerResult.redirectUrl || payment.redirectUrl
    });

    return {
      paymentId: payment.paymentId,
      status: payment.status,
      redirectUrl: providerResult.redirectUrl || payment.redirectUrl,
      provider: payment.provider,
      bankId: payment.bankId,
      amount: payment.amount,
      createdAt: payment.createdAt,
      expiresAt: payment.expiresAt
    };

  } catch (error: any) {
    logger.error('Error creating payment:', {
      clientId: request.clientId,
      provider: request.provider,
      error: error.message
    });
    throw error;
  }
};

// Get payment by ID
export const getPayment = async (paymentId: string, clientId?: string): Promise<IPayment> => {
  try {
    const query: any = { paymentId };
    if (clientId) {
      query.clientId = clientId;
    }
    
    const payment = await Payment.findOne(query);
    if (!payment) {
      throw createError('Payment not found', 404);
    }
    
    return payment;
  } catch (error: any) {
    logger.error('Error fetching payment:', { paymentId, error: error.message });
    throw error;
  }
};

// Get payments for a client
export const getPayments = async (
  clientId: string,
  options: {
    status?: PaymentStatus;
    provider?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{
  payments: IPayment[];
  total: number;
}> => {
  try {
    const query: any = { clientId };
    
    if (options.status) {
      query.status = options.status;
    }
    
    if (options.provider) {
      query.provider = options.provider;
    }
    
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    
    const [payments, total] = await Promise.all([
      Payment.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset),
      Payment.countDocuments(query)
    ]);
    
    return { payments, total };
  } catch (error: any) {
    logger.error('Error fetching payments:', { clientId, error: error.message });
    throw error;
  }
};

// Update payment status from provider
export const syncPaymentStatus = async (paymentId: string): Promise<IPayment> => {
  try {
    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      throw createError('Payment not found', 404);
    }
    
    // Skip if payment is already in final state
    if ([PaymentStatus.COMPLETED, PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.EXPIRED].includes(payment.status)) {
      return payment;
    }
    
    // Get provider adapter and fetch status
    const adapter = getPaymentAdapter(payment.provider);
    const providerPaymentId = payment.providerData.originalPaymentId;
    
    if (!providerPaymentId) {
      throw createError('Provider payment ID not found', 400);
    }
    
    const statusResult = await adapter.getPaymentStatus(providerPaymentId);
    
    // Update status if changed
    if (statusResult.status !== payment.status) {
      const oldStatus = payment.status;
      payment.status = statusResult.status;
      payment.statusHistory.push({
        status: statusResult.status,
        timestamp: new Date(),
        provider: payment.provider,
        details: 'Status synced from provider'
      });
      
      // Update completed timestamp if payment is completed
      if (statusResult.status === PaymentStatus.COMPLETED) {
        payment.completedAt = new Date();
      }
      
      // Update provider data with latest details
      payment.providerData.rawResponse = statusResult.details;
      
      await payment.save();
      
      logger.info('Payment status synced:', {
        paymentId,
        oldStatus,
        newStatus: statusResult.status,
        provider: payment.provider
      });
    }
    
    return payment;
  } catch (error: any) {
    logger.error('Error syncing payment status:', { paymentId, error: error.message });
    throw error;
  }
};

// Cancel a payment
export const cancelPayment = async (paymentId: string, clientId?: string): Promise<IPayment> => {
  try {
    const query: any = { paymentId };
    if (clientId) {
      query.clientId = clientId;
    }
    
    const payment = await Payment.findOne(query);
    if (!payment) {
      throw createError('Payment not found', 404);
    }
    
    // Check if payment can be cancelled
    if ([PaymentStatus.COMPLETED, PaymentStatus.FAILED, PaymentStatus.CANCELLED].includes(payment.status)) {
      throw createError(`Payment cannot be cancelled in ${payment.status} status`, 400);
    }
    
    // Cancel with provider if payment was submitted
    const providerPaymentId = payment.providerData.originalPaymentId;
    if (providerPaymentId) {
      try {
        const adapter = getPaymentAdapter(payment.provider);
        await adapter.cancelPayment(providerPaymentId);
      } catch (providerError: any) {
        logger.warn('Provider cancellation failed, marking as cancelled anyway:', {
          paymentId,
          providerError: providerError.message
        });
      }
    }
    
    // Update payment status
    payment.status = PaymentStatus.CANCELLED;
    payment.statusHistory.push({
      status: PaymentStatus.CANCELLED,
      timestamp: new Date(),
      provider: payment.provider,
      details: 'Payment cancelled by client'
    });
    await payment.save();
    
    logger.info('Payment cancelled:', { paymentId, clientId });
    
    return payment;
  } catch (error: any) {
    logger.error('Error cancelling payment:', { paymentId, error: error.message });
    throw error;
  }
};

// Get supported providers for payments
export const getSupportedProviders = (): string[] => {
  return ['token']; // Will expand as we add more providers
};

// Clean up expired payments (utility function for cron jobs)
export const cleanupExpiredPayments = async (): Promise<number> => {
  try {
    const result = await Payment.updateMany(
      {
        status: { $in: [PaymentStatus.PENDING, PaymentStatus.AUTHORIZING] },
        expiresAt: { $lt: new Date() }
      },
      {
        $set: { status: PaymentStatus.EXPIRED },
        $push: {
          statusHistory: {
            status: PaymentStatus.EXPIRED,
            timestamp: new Date(),
            details: 'Payment expired due to timeout'
          }
        }
      }
    );
    
    logger.info('Cleaned up expired payments:', { count: result.modifiedCount });
    return result.modifiedCount;
  } catch (error: any) {
    logger.error('Error cleaning up expired payments:', { error: error.message });
    throw error;
  }
};

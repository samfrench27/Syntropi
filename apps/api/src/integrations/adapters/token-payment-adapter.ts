// apps/api/src/integrations/adapters/token-payment-adapter.ts
import axios from 'axios';
import { createError } from '../../middleware/errorHandler';
import { winstonLogger as logger } from '../../utils/logger';
import { IPayment, PaymentStatus, PaymentFlowType } from '../../models/payment.model';

// Token.io API base URL
const TOKEN_API_BASE = process.env.TOKEN_API_BASE_URL || 'https://api.sandbox.token.io';
const TOKEN_API_KEY = process.env.TOKEN_API_KEY || 'bS0zY25ia2M5NlR5MWlQQlhSTWZEU2pidTM5SlAzLTV6S3RYRUFxOmFlNjJjNmRkLWY0YjItNDQ5MC1iMGNkLTgyZGFkZWFlMDMzYQ==';

// Token.io payment initiation request format (corrected)
interface TokenPaymentRequest {
  initiation: {
    bankId?: string;
    refId: string;
    remittanceInformationPrimary: string;
    amount: {
      value: string;
      currency: string;
    };
    localInstrument: 'FASTER_PAYMENTS' | 'SEPA' | 'SEPA_INSTANT';
    creditor: {
      sortCode?: string;
      accountNumber?: string;
      iban?: string;
      bic?: string;
      name: string;
    };
    debtor?: {
      sortCode?: string;
      accountNumber?: string;
      iban?: string;
      bic?: string;
      name: string;
    };
    callbackUrl: string;
    flowType: 'API_ONLY' | 'FULL_HOSTED_PAGES' | 'EMBEDDED_HOSTED_PAGES';
  };
  pispConsentAccepted?: boolean;
}

// Token.io payment response format
interface TokenPaymentResponse {
  payment: {
    id: string;
    memberId: string;
    initiation: {
      refId: string;
      remittanceInformationPrimary: string;
      remittanceInformationSecondary?: string;
      amount: {
        value: string;
        currency: string;
      };
      localInstrument: string;
      creditor: {
        name: string;
        sortCode?: string;
        accountNumber?: string;
        iban?: string;
        bic?: string;
      };
      callbackUrl: string;
      callbackState?: string;
      flowType: string;
    };
    createdDateTime: string;
    updatedDateTime: string;
    status: string;
    statusReasonInformation?: string;
    authentication?: {
      redirectUrl?: string;
      type?: string;
      fields?: any[];
    };
  };
}

// Map Syntropi payment status to Token.io status
const mapSyntropiToTokenStatus = (status: PaymentStatus): string => {
  switch (status) {
    case PaymentStatus.PENDING:
      return 'PENDING';
    case PaymentStatus.AUTHORIZING:
      return 'PENDING_AUTHENTICATION';
    case PaymentStatus.AUTHORIZED:
      return 'PENDING_SUBMISSION';
    case PaymentStatus.SUBMITTED:
      return 'SUBMITTED';
    case PaymentStatus.ACCEPTED:
      return 'ACCEPTED';
    case PaymentStatus.COMPLETED:
      return 'COMPLETED';
    case PaymentStatus.FAILED:
      return 'FAILED';
    case PaymentStatus.CANCELLED:
      return 'CANCELLED';
    case PaymentStatus.EXPIRED:
      return 'EXPIRED';
    default:
      return 'PENDING';
  }
};

// Map Token.io status to Syntropi status
const mapTokenToSyntropiStatus = (tokenStatus: string | undefined): PaymentStatus => {
  if (!tokenStatus) {
    return PaymentStatus.PENDING;
  }
  
  switch (tokenStatus.toUpperCase()) {
    case 'PENDING':
      return PaymentStatus.PENDING;
    case 'PENDING_AUTHENTICATION':
      return PaymentStatus.AUTHORIZING;
    case 'PENDING_SUBMISSION':
      return PaymentStatus.AUTHORIZED;
    case 'SUBMITTED':
      return PaymentStatus.SUBMITTED;
    case 'ACCEPTED':
      return PaymentStatus.ACCEPTED;
    case 'COMPLETED':
      return PaymentStatus.COMPLETED;
    case 'FAILED':
      return PaymentStatus.FAILED;
    case 'CANCELLED':
      return PaymentStatus.CANCELLED;
    case 'EXPIRED':
      return PaymentStatus.EXPIRED;
    default:
      return PaymentStatus.PENDING;
  }
};

// Map Syntropi flow type to Token.io flow type
const mapFlowType = (flowType: PaymentFlowType): string => {
  switch (flowType) {
    case PaymentFlowType.API_ONLY:
      return 'API_ONLY';
    case PaymentFlowType.HOSTED_PAGES:
      return 'FULL_HOSTED_PAGES';
    case PaymentFlowType.EMBEDDED_HOSTED_PAGES:
      return 'EMBEDDED_HOSTED_PAGES';
    default:
      return 'API_ONLY';
  }
};

// Build Token.io payment request from Syntropi payment
const buildTokenPaymentRequest = (payment: IPayment): TokenPaymentRequest => {
  // Generate a unique reference ID (max 35 characters for Token.io)
  const refId = payment.paymentId.substring(0, 35);
  
  // Determine local instrument based on account details
  let localInstrument: 'FASTER_PAYMENTS' | 'SEPA' | 'SEPA_INSTANT';
  if (payment.toAccount.iban) {
    localInstrument = 'SEPA';
  } else if (payment.toAccount.sortCode && payment.toAccount.accountNumber) {
    localInstrument = 'FASTER_PAYMENTS';
  } else {
    throw createError('Invalid account details: must have either IBAN or sortCode+accountNumber', 400);
  }

  const request: TokenPaymentRequest = {
    initiation: {
      refId,
      remittanceInformationPrimary: payment.reference?.reference || `Payment ${payment.paymentId}`,
      amount: {
        value: payment.amount.value,
        currency: payment.amount.currency
      },
      localInstrument,
      creditor: {
        name: payment.toAccount.accountName
      },
      callbackUrl: payment.redirectUrl || 'https://api.syntropi.co.uk/callback',
      flowType: mapFlowType(payment.flowType) as any
    },
    pispConsentAccepted: true
  };

  // Set creditor account details based on local instrument
  if (localInstrument === 'SEPA') {
    request.initiation.creditor.iban = payment.toAccount.iban;
    if (payment.toAccount.bic) {
      request.initiation.creditor.bic = payment.toAccount.bic;
    }
  } else if (localInstrument === 'FASTER_PAYMENTS') {
    request.initiation.creditor.sortCode = payment.toAccount.sortCode;
    request.initiation.creditor.accountNumber = payment.toAccount.accountNumber;
  }

  // Set debtor details if provided
  if (payment.fromAccount?.accountName) {
    request.initiation.debtor = {
      name: payment.fromAccount.accountName
    };
    
    if (payment.fromAccount.iban) {
      request.initiation.debtor.iban = payment.fromAccount.iban;
      if (payment.fromAccount.bic) {
        request.initiation.debtor.bic = payment.fromAccount.bic;
      }
    } else if (payment.fromAccount.sortCode && payment.fromAccount.accountNumber) {
      request.initiation.debtor.sortCode = payment.fromAccount.sortCode;
      request.initiation.debtor.accountNumber = payment.fromAccount.accountNumber;
    }
  }

  // Set bank ID if provided
  if (payment.bankId) {
    request.initiation.bankId = payment.bankId;
  }

  return request;
};

// Create a payment with Token.io
export const createPayment = async (payment: IPayment): Promise<{
  tokenPaymentId: string;
  redirectUrl?: string;
  status: PaymentStatus;
}> => {
  try {
    // Debug logging
    console.log('TOKEN_API_KEY present:', !!TOKEN_API_KEY);
    console.log('TOKEN_API_BASE:', TOKEN_API_BASE);
    
    if (!TOKEN_API_KEY) {
      throw createError('Token.io API key not configured', 500);
    }

    const tokenRequest = buildTokenPaymentRequest(payment);
    
    logger.info('Creating Token.io payment:', {
      paymentId: payment.paymentId,
      url: `${TOKEN_API_BASE}/v2/payments`,
      headers: {
        'Authorization': `Basic ${TOKEN_API_KEY}`,
        'Content-Type': 'application/json'
      },
      tokenRequest: JSON.stringify(tokenRequest, null, 2)
    });

    const response = await axios.post<TokenPaymentResponse>(
      `${TOKEN_API_BASE}/v2/payments`,
      tokenRequest,
      {
        headers: {
          'Authorization': `Basic ${TOKEN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const tokenPayment = response.data;
    
    // Console log for immediate debugging
    console.log('=== TOKEN.IO RESPONSE DEBUG ===');
    console.log('Full response:', JSON.stringify(tokenPayment, null, 2));
    console.log('Authentication object:', tokenPayment.payment.authentication);
    console.log('Redirect URL from auth:', tokenPayment.payment.authentication?.redirectUrl);
    console.log('=== END DEBUG ===');
    
    // Log the complete Token.io response for debugging
    logger.info('Token.io payment created - Full Response:', {
      paymentId: payment.paymentId,
      tokenPaymentId: tokenPayment.payment.id,
      status: tokenPayment.payment.status,
      fullResponse: JSON.stringify(tokenPayment, null, 2),
      authenticationObject: tokenPayment.payment.authentication,
      redirectUrlFromAuth: tokenPayment.payment.authentication?.redirectUrl
    });

    return {
      tokenPaymentId: tokenPayment.payment.id,
      redirectUrl: tokenPayment.payment.authentication?.redirectUrl,
      status: mapTokenToSyntropiStatus(tokenPayment.payment.status)
    };

  } catch (error: any) {
    logger.error('Error creating Token.io payment:', {
      paymentId: payment.paymentId,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      error: error.message
    });

    // Handle specific Token.io errors
    if (error.response?.status === 400) {
      throw createError(`Invalid payment request: ${JSON.stringify(error.response.data) || error.message}`, 400);
    } else if (error.response?.status === 401) {
      throw createError('Invalid Token.io API credentials', 401);
    } else if (error.response?.status === 403) {
      throw createError('Insufficient permissions for Token.io API', 403);
    }

    throw createError(`Token.io payment creation failed: ${error.message}`, 500);
  }
};

// Get payment status from Token.io
export const getPaymentStatus = async (tokenPaymentId: string): Promise<{
  status: PaymentStatus;
  details?: any;
}> => {
  try {
    if (!TOKEN_API_KEY) {
      throw createError('Token.io API key not configured', 500);
    }

    const response = await axios.get<TokenPaymentResponse>(
      `${TOKEN_API_BASE}/v2/payments/${tokenPaymentId}`,
      {
        headers: {
          'Authorization': `Basic ${TOKEN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const tokenPayment = response.data;
    
    return {
      status: mapTokenToSyntropiStatus(tokenPayment.payment.status),
      details: tokenPayment
    };

  } catch (error: any) {
    logger.error('Error fetching Token.io payment status:', {
      tokenPaymentId,
      error: error.response?.data || error.message
    });

    if (error.response?.status === 404) {
      throw createError(`Payment not found: ${tokenPaymentId}`, 404);
    }

    throw createError(`Failed to fetch payment status: ${error.message}`, 500);
  }
};

// Cancel a payment with Token.io
export const cancelPayment = async (tokenPaymentId: string): Promise<void> => {
  try {
    if (!TOKEN_API_KEY) {
      throw createError('Token.io API key not configured', 500);
    }

    await axios.delete(
      `${TOKEN_API_BASE}/v2/payments/${tokenPaymentId}`,
      {
        headers: {
          'Authorization': `Basic ${TOKEN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info('Token.io payment cancelled:', { tokenPaymentId });

  } catch (error: any) {
    logger.error('Error cancelling Token.io payment:', {
      tokenPaymentId,
      error: error.response?.data || error.message
    });

    if (error.response?.status === 404) {
      throw createError(`Payment not found: ${tokenPaymentId}`, 404);
    }

    throw createError(`Failed to cancel payment: ${error.message}`, 500);
  }
};

// Get supported banks for payments (reuse from bank adapter)
export const getSupportedBanks = async (): Promise<Array<{
  id: string;
  name: string;
  country: string;
  supportsPayments: boolean;
}>> => {
  try {
    // This would typically call the Token.io banks endpoint
    // and filter for payment support
    return [];
  } catch (error: any) {
    logger.error('Error fetching supported banks for payments:', error);
    throw createError(`Failed to fetch supported banks: ${error.message}`, 500);
  }
};

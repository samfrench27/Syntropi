import { PaymentSession, Bank } from '@/types/payment';

// Mock payment data for demo purposes
export const mockPaymentSession: PaymentSession = {
  paymentId: 'pay_dc07678a31104724ad04f36bd5ea4a97',
  status: 'PENDING',
  amount: {
    value: '2.00',
    currency: 'GBP'
  },
  reference: 'RemittancePrimary3ccS8rztHO5R1eE',
  description: 'Payment for services rendered',
  toAccount: {
    accountName: 'samfrenchio',
    accountNumber: '12345678',
    sortCode: '12-34-56'
  },
  fromAccount: {
    accountName: 'Customer Account',
    accountNumber: '87654321',
    sortCode: '65-43-21'
  },
  merchant: {
    name: 'Test Organisation',
    logo: '/api/placeholder/120/40',
    redirectUri: 'https://example.com/return'
  },
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes from now
};

// Mock bank data - simplified structure, real API provides S3 logos
export const mockBanks: Bank[] = [
  {
    id: 'natwest',
    name: 'NatWest Bank',
    displayName: 'NatWest',
    available: true,
    supportsInstantPayments: true,
    processingTime: 'Instant'
  },
  {
    id: 'hsbc',
    name: 'HSBC UK',
    displayName: 'HSBC',
    available: true,
    supportsInstantPayments: true,
    processingTime: 'Instant'
  },
  {
    id: 'barclays',
    name: 'Barclays Bank',
    displayName: 'Barclays',
    available: true,
    supportsInstantPayments: false,
    processingTime: '1-2 hours'
  },
  {
    id: 'lloyds',
    name: 'Lloyds Bank',
    displayName: 'Lloyds',
    available: true,
    supportsInstantPayments: true,
    processingTime: 'Instant'
  },
  {
    id: 'santander',
    name: 'Santander UK',
    displayName: 'Santander',
    available: true,
    supportsInstantPayments: false,
    processingTime: '2-4 hours'
  },
  {
    id: 'nationwide',
    name: 'Nationwide Building Society',
    displayName: 'Nationwide',
    available: true,
    supportsInstantPayments: true,
    processingTime: 'Instant'
  }
];

// Mock API functions for development/demo
export const mockAPI = {
  getPayment: async (paymentId: string) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (paymentId === 'demo-payment-id' || paymentId === mockPaymentSession.paymentId) {
      return {
        success: true,
        data: mockPaymentSession
      };
    }
    
    throw new Error('Payment not found');
  },

  getAvailableBanks: async () => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      data: mockBanks.filter(bank => bank.available)
    };
  },

  initiatePayment: async (request: any) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simulate bank redirect URL
    const bankRedirectUrl = `https://online.${request.bankId}.co.uk/auth?session=${Date.now()}`;
    
    return {
      success: true,
      data: {
        paymentId: request.paymentId,
        status: 'AUTHORIZING',
        redirectUrl: bankRedirectUrl,
        sessionId: `session_${Date.now()}`
      }
    };
  }
};

// Utility function to check if we should use mock data
export const shouldUseMockData = () => {
  return process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
};

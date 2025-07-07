export interface PaymentSession {
  paymentId: string;
  status: 'PENDING' | 'AUTHORIZING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  amount: {
    value: string;
    currency: string;
  };
  reference?: string;
  description?: string;
  toAccount: {
    accountName: string;
    accountNumber?: string;
    sortCode?: string;
  };
  fromAccount?: {
    accountName: string;
    accountNumber?: string;
    sortCode?: string;
  };
  merchant?: {
    name: string;
    logo?: string;
    redirectUri?: string;
  };
  createdAt: string;
  expiresAt: string;
}

export interface Bank {
  id: string;
  name: string;
  displayName: string;
  logo?: string;
  color?: string;
  available: boolean;
  supportsInstantPayments?: boolean;
  processingTime?: string;
}

export interface PaymentInitiationRequest {
  paymentId: string;
  bankId: string;
  flowType: 'API_ONLY' | 'HOSTED';
  redirectUri?: string;
}

export interface PaymentInitiationResponse {
  paymentId: string;
  status: string;
  redirectUrl?: string;
  authorizationUrl?: string;
  sessionId?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

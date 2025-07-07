import axios from 'axios';
import { 
  PaymentSession, 
  Bank, 
  PaymentInitiationRequest, 
  PaymentInitiationResponse,
  ApiResponse 
} from '@/types/payment';
import { mockAPI, shouldUseMockData } from './mockData';

// Create axios instance pointing to our main API
const api = axios.create({
  baseURL: (process.env.NEXT_PUBLIC_API_URL || '') + '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Debug: Log the baseURL being used
console.log('API baseURL:', (process.env.NEXT_PUBLIC_API_URL || '') + '/api');

// Add request interceptor for auth
api.interceptors.request.use((config) => {
  // For hosted pages, we use payment-specific tokens or fallback to general token
  const url = config.url || '';
  
  // Extract payment ID from URL to get the right token
  const paymentIdMatch = url.match(/\/payments\/([^\/\?]+)/);
  if (paymentIdMatch) {
    const paymentId = paymentIdMatch[1];
    const paymentToken = typeof window !== 'undefined' 
      ? localStorage.getItem(`payment_token_${paymentId}`)
      : null;
    
    if (paymentToken) {
      config.headers.Authorization = `Bearer ${paymentToken}`;
      return config;
    }
  }
  
  // Fallback to general hosted pages token if available
  const hostedPagesToken = process.env.NEXT_PUBLIC_HOSTED_PAGES_TOKEN;
  if (hostedPagesToken) {
    config.headers.Authorization = `Bearer ${hostedPagesToken}`;
  }
  
  return config;
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If API is unavailable and we're in development, fall back to mock data
    if (shouldUseMockData() && (error.code === 'ECONNREFUSED' || error.code === 'NETWORK_ERROR')) {
      console.warn('API unavailable, falling back to mock data');
      error.useMockFallback = true;
    }
    return Promise.reject(error);
  }
);

// Payment API methods
export const paymentAPI = {
  // Get payment details by ID
  getPayment: async (paymentId: string): Promise<ApiResponse<PaymentSession>> => {
    try {
      // For hosted pages, use the dedicated hosted endpoint with token auth
      const response = await api.get(`/payments/${paymentId}/hosted`);
      return response.data;
    } catch (error: any) {
      // If API call fails and we're in development, fall back to mock data
      if (error.useMockFallback || shouldUseMockData()) {
        console.warn('Using mock data for payment:', paymentId);
        return mockAPI.getPayment(paymentId);
      }
      
      // If unauthorized, provide clear error message
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Access denied: Invalid or missing payment access token');
      }
      
      throw error;
    }
  },

  // Initiate payment with selected bank
  initiatePayment: async (request: PaymentInitiationRequest): Promise<ApiResponse<PaymentInitiationResponse>> => {
    try {
      const response = await api.post('/payments/initiate', request);
      return response.data;
    } catch (error: any) {
      if (error.useMockFallback || shouldUseMockData()) {
        return await mockAPI.initiatePayment(request);
      }
      throw error;
    }
  },

  // Get payment status
  getPaymentStatus: async (paymentId: string): Promise<ApiResponse<PaymentSession>> => {
    try {
      const response = await api.get(`/payments/${paymentId}/status`);
      return response.data;
    } catch (error: any) {
      if (error.useMockFallback || shouldUseMockData()) {
        return await mockAPI.getPayment(paymentId);
      }
      throw error;
    }
  },

  // Cancel payment
  cancelPayment: async (paymentId: string): Promise<ApiResponse<void>> => {
    try {
      const response = await api.post(`/payments/${paymentId}/cancel`);
      return response.data;
    } catch (error: any) {
      if (error.useMockFallback || shouldUseMockData()) {
        return { success: true, data: undefined };
      }
      throw error;
    }
  }
};

// Banks API methods
export const banksAPI = {
  // Get available banks for payment
  getAvailableBanks: async (paymentId?: string): Promise<ApiResponse<Bank[]>> => {
    try {
      // If we have a payment ID, use it to get the right token
      const config: any = {};
      if (paymentId && typeof window !== 'undefined') {
        const paymentToken = localStorage.getItem(`payment_token_${paymentId}`);
        if (paymentToken) {
          config.headers = {
            Authorization: `Bearer ${paymentToken}`
          };
        }
      }
      
      const response = await api.get('/banks', config);
      return response.data;
    } catch (error: any) {
      if (error.useMockFallback || shouldUseMockData()) {
        return await mockAPI.getAvailableBanks();
      }
      throw error;
    }
  },

  // Get specific bank details
  getBank: async (bankId: string): Promise<ApiResponse<Bank>> => {
    try {
      const response = await api.get(`/banks/${bankId}`);
      return response.data;
    } catch (error: any) {
      if (error.useMockFallback || shouldUseMockData()) {
        const banksResponse = await mockAPI.getAvailableBanks();
        const bank = banksResponse.data.find(b => b.id === bankId);
        if (bank) {
          return { success: true, data: bank };
        }
        throw new Error('Bank not found');
      }
      throw error;
    }
  }
};

// Utility function to handle API errors
export const handleApiError = (error: any): string => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

export default api;

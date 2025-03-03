// src/lib/clientApi.ts
import axios from 'axios';
import { getToken, clearAuth } from './auth';
import { logApiRequest, logApiResponse, debugLog } from './debug';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

const clientApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
clientApi.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      // Log all requests with their headers for debugging
      logApiRequest(
        config.method?.toUpperCase() || 'UNKNOWN',
        config.url || 'unknown-url',
        config.data,
        {
          ...config.headers,
          // Mask the full token for security, but show first and last few chars
          Authorization: token ? `Bearer ${token.substr(0, 5)}...${token.substr(-5)}` : undefined
        }
      );
    }
    return config;
  },
  (error) => {
    debugLog('ClientAPI', 'Request Error', error, true);
    return Promise.reject(error);
  }
);

// Handle auth errors and log responses
clientApi.interceptors.response.use(
  (response) => {
    // Log successful responses
    logApiResponse(
      response.config.url || 'unknown-url',
      response.status,
      response.data
    );
    return response;
  },
  (error) => {
    // Log error responses
    if (error.response) {
      logApiResponse(
        error.config.url || 'unknown-url',
        error.response.status,
        error.response.data
      );
      
      if (error.response.status === 401) {
        // Clear auth and redirect to login
        debugLog('ClientAPI', 'Authentication Failed', 'Clearing auth and redirecting', true);
        clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    } else {
      debugLog('ClientAPI', 'Network Error', error.message || error, true);
    }
    return Promise.reject(error);
  }
);

// Client API services (all operate within the user's organization context)
export const clientAuthAPI = {
  login: (email: string, password: string) => 
    clientApi.post('/client/auth/login', { email, password }),
  
  me: () => clientApi.get('/client/auth/me'),
  
  updatePassword: (currentPassword: string, newPassword: string) =>
    clientApi.post('/client/auth/update-password', { currentPassword, newPassword }),
};

export const clientOrganizationAPI = {
  // Get the current organization details
  getOrganization: () => clientApi.get('/client/organization'),
  
  // Update organization settings (limited fields for client users)
  updateOrganization: (orgData: {
    contactEmail?: string;
    billingEmail?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
    settings?: {
      webhookUrl?: string;
    };
  }) => clientApi.put('/client/organization', orgData),
};

export const clientAPIKeyAPI = {
  getApiKeys: (params?: {
    page?: number;
    limit?: number;
    environment?: string;
  }) => clientApi.get('/client/api-keys', { params }),
  
  getApiKey: (id: string) => clientApi.get(`/client/api-keys/${id}`),
  
  createApiKey: (keyData: {
    name: string;
    environment?: 'sandbox' | 'production';
    permissions?: string[];
  }) => clientApi.post('/client/api-keys', keyData),
  
  revokeApiKey: (id: string) => clientApi.delete(`/client/api-keys/${id}`),
};

export const clientUsageAPI = {
  getUsageSummary: (params?: {
    startDate?: string;
    endDate?: string;
  }) => clientApi.get('/client/usage/summary', { params }),
  
  getUsageDetails: (params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }) => clientApi.get('/client/usage/details', { params }),
};

export default clientApi;
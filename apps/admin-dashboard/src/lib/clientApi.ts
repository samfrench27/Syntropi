// src/lib/clientApi.ts
import axios from 'axios';
import { getToken, clearAuth } from './auth';

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
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle auth errors
clientApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth and redirect to login
      clearAuth();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
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

export const clientOrganizationAPI = {
  getOrganization: () => clientApi.get('/client/organization'),
  
  updateOrganization: (orgData: {
    name?: string;
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

export default clientApi;
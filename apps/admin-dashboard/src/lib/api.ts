// src/lib/api.ts
import axios from 'axios';
import { clearAuth } from './auth';
import { getFreshToken, supabaseAuth } from './supabase';
import { logApiRequest, logApiResponse, debugLog } from './debug';

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await getFreshToken();
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
    debugLog('API', 'Request Error', error, true);
    return Promise.reject(error);
  }
);

// Handle auth errors and log responses
api.interceptors.response.use(
  (response) => {
    // Log successful responses
    logApiResponse(
      response.config.url || 'unknown-url',
      response.status,
      response.data
    );
    return response;
  },
  async (error) => {
    // Log error responses
    if (error.response) {
      logApiResponse(
        error.config.url || 'unknown-url',
        error.response.status,
        error.response.data
      );
      
      if (error.response.status === 401 && !error.config._retried) {
        // The role may have changed or the token expired: refresh the session once and retry
        error.config._retried = true;
        const { data } = await supabaseAuth.refreshSession();
        if (data.session) {
          error.config.headers.Authorization = `Bearer ${data.session.access_token}`;
          return api.request(error.config);
        }
      }

      if (error.response.status === 401) {
        // Only clear auth and redirect for admin/auth endpoints
        // Don't logout for API key-protected public endpoints like payments
        const url = error.config.url || '';
        const isAuthEndpoint = url.includes('/admin/auth') || url.includes('/admin/') && !url.includes('/payments');
        
        if (isAuthEndpoint) {
          // Clear auth and redirect to login
          debugLog('API', 'Authentication Failed on auth endpoint', `URL: ${url}`, true);
          clearAuth();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        } else {
          // Log but don't logout for non-auth endpoints
          debugLog('API', 'Authorization Failed on public endpoint', `URL: ${url} - API key issue`, true);
        }
      }
    } else {
      debugLog('API', 'Network Error', error.message || error, true);
    }
    return Promise.reject(error);
  }
);

// Authentication API. Sign-in, sign-out and password reset go straight to Supabase (see AuthContext).
export const authAPI = {
  me: () => api.get('/auth/me'),

  signup: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName: string;
  }) => api.post('/auth/signup', data),
};

// User management API
export const userAPI = {
  getUsers: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
    organizationId?: string;
  }) => api.get('/admin/users', { params }),
  
  getUser: (id: string) => api.get(`/admin/users/${id}`),
  
  createUser: (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
    organizationId: string;
  }) => api.post('/admin/users', userData),
  
  updateUser: (id: string, userData: {
    firstName?: string;
    lastName?: string;
    role?: string;
    status?: string;
  }) => api.put(`/admin/users/${id}`, userData),
  
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  
  getUserActivities: (id: string, params?: {
    page?: number;
    limit?: number;
  }) => api.get(`/admin/users/${id}/activities`, { params }),
};

// Organization management API
export const organizationAPI = {
  // Admin endpoints
  getOrganizations: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    plan?: string;
    status?: string;
  }) => api.get('/admin/organizations', { params }),
  
  getOrganization: (id: string) => api.get(`/admin/organizations/${id}`),
  
  // Client endpoint for current org
  getCurrentOrganization: () => api.get('/client/organization'),
  
  createOrganization: (orgData: {
    name: string;
    contactEmail: string;
    billingEmail?: string;
    plan?: string;
    ownerId?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
    settings?: {
      allowedProviders?: string[];
      rateLimit?: number;
      webhookUrl?: string;
    };
  }) => api.post('/admin/organizations', orgData),
  
  updateOrganization: (id: string, orgData: {
    name?: string;
    contactEmail?: string;
    billingEmail?: string;
    plan?: string;
    status?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
    settings?: {
      allowedProviders?: string[];
      rateLimit?: number;
      webhookUrl?: string;
    };
  }) => api.put(`/admin/organizations/${id}`, orgData),
  
  deleteOrganization: (id: string) => api.delete(`/admin/organizations/${id}`),
  
  getOrganizationUsers: (id: string, params?: {
    page?: number;
    limit?: number;
  }) => api.get(`/admin/organizations/${id}/users`, { params }),
  
  getOrganizationApiKeys: (id: string, params?: {
    page?: number;
    limit?: number;
  }) => api.get(`/admin/organizations/${id}/api-keys`, { params }),
  
  getOrganizationActivities: (id: string, params?: {
    page?: number;
    limit?: number;
  }) => api.get(`/admin/organizations/${id}/activities`, { params }),
};

// API Key management API
export const apiKeyAPI = {
  getApiKeys: (params?: {
    page?: number;
    limit?: number;
    organizationId?: string;
    environment?: string;
    isActive?: boolean;
  }) => api.get('/admin/api-keys', { params }),
  
  getApiKey: (id: string) => api.get(`/admin/api-keys/${id}`),
  
  createApiKey: (keyData: {
    name: string;
    organizationId: string;
    environment?: 'sandbox' | 'production';
    permissions?: string[];
  }) => api.post('/admin/api-keys', keyData),
  
  revokeApiKey: (id: string) => api.delete(`/admin/api-keys/${id}`),
};

// Activity logs API
export const activityAPI = {
  getActivities: (params?: {
    page?: number;
    limit?: number;
    userId?: string;
    organizationId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }) => api.get('/admin/activities', { params }),
  
  getActivity: (id: string) => api.get(`/admin/activities/${id}`),

  // Client-specific endpoint for the client dashboard
  getClientActivities: (params?: {
    page?: number;
    limit?: number;
    organizationId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }) => api.get('/client/activities', { params }),
};

// Provider management API
export const providerAPI = {
  getProviders: () => api.get('/admin/providers'),
  
  getProvider: (id: string) => api.get(`/admin/providers/${id}`),
  
  createProvider: (providerData: {
    name: string;
    code: string;
    description: string;
    apiSpec: {
      baseUrl: string;
      version: string;
      documentation?: string;
    };
    features?: string[];
    status?: 'active' | 'maintenance' | 'inactive';
    logoUrl?: string;
    settings?: any;
  }) => api.post('/admin/providers', providerData),
  
  updateProvider: (id: string, providerData: {
    name?: string;
    description?: string;
    apiSpec?: {
      baseUrl?: string;
      version?: string;
      documentation?: string;
    };
    features?: string[];
    status?: 'active' | 'maintenance' | 'inactive';
    logoUrl?: string;
    settings?: any;
  }) => api.put(`/admin/providers/${id}`, providerData),
  
  deleteProvider: (id: string) => api.delete(`/admin/providers/${id}`),
};

// Analytics API (using existing endpoints)
export const analyticsAPI = {
  // Get activities for endpoint analytics
  getActivities: (params?: {
    page?: number;
    limit?: number;
    action?: string;
    startDate?: string;
    endDate?: string;
    organizationId?: string;
  }) => api.get('/admin/activities', { params }),
};

// Payments API (for admin dashboard)
export const paymentsAPI = {
  // Get payments with filters for analytics
  getPayments: (params?: {
    status?: string;
    provider?: string;
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }) => api.get('/payments', { 
    params,
    headers: {
      'x-api-key': process.env.NEXT_PUBLIC_API_KEY // Will need API key for payment endpoints
    }
  }),
  
  // Get single payment details
  getPayment: (paymentId: string) => api.get(`/payments/${paymentId}`, {
    headers: {
      'x-api-key': process.env.NEXT_PUBLIC_API_KEY
    }
  }),
};

// Billing API
export const billingAPI = {
  // Client billing endpoints
  getSubscription: () => api.get('/client/billing/subscription'),
  
  createSubscription: (data: { plan: string }) => 
    api.post('/client/billing/subscription', data),
  
  updateSubscription: (data: { plan: string }) => 
    api.put('/client/billing/subscription', data),
  
  cancelSubscription: () => api.delete('/client/billing/subscription'),
  
  getBillingUsage: (params?: { months?: number }) => 
    api.get('/client/billing/usage', { params }),
  
  createBillingPortalSession: () => 
    api.post('/client/billing/portal'),

  handleCheckoutSuccess: (data: { sessionId: string }) =>
    api.post('/client/billing/checkout/success', data),

  // Admin billing endpoints  
  getRevenue: (params?: { months?: number }) => 
    api.get('/admin/billing/revenue', { params }),
  
  getCustomers: (params?: { page?: number; limit?: number }) => 
    api.get('/admin/billing/customers', { params }),
  
  getSubscriptions: (params?: { page?: number; limit?: number; status?: string }) => 
    api.get('/admin/billing/subscriptions', { params }),
  
  getMetrics: () => api.get('/admin/billing/metrics'),
};

export default api;
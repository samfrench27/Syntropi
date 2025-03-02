import axios from 'axios';
import { getToken, clearAuth } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
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
api.interceptors.response.use(
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

// Authentication API
export const authAPI = {
  login: (email: string, password: string) => 
    api.post('/admin/auth/login', { email, password }),
  
  forgotPassword: (email: string) => 
    api.post('/admin/auth/forgot-password', { email }),
  
  resetPassword: (token: string, password: string) => 
    api.post('/admin/auth/reset-password', { token, password }),
  
  me: () => api.get('/admin/auth/me'),
  
  createFirstAdmin: (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => api.post('/admin/auth/create-first-admin', userData),
  checkSetupStatus: () => api.get('/admin/auth/setup-status'),
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
  getOrganizations: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    plan?: string;
    status?: string;
  }) => api.get('/admin/organizations', { params }),
  
  getOrganization: (id: string) => api.get(`/admin/organizations/${id}`),
  
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

export default api;
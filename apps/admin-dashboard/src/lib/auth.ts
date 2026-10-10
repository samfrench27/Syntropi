// src/lib/auth.ts
import { jwtDecode } from 'jwt-decode';
import { debugLog } from './debug';

interface AuthToken {
  userId: string;
  role: string;
  organizationId?: string;
  iat: number;
  exp: number;
}

const TOKEN_KEY = 'syntropi_admin_token';
const USER_KEY = 'syntropi_admin_user';
const ORG_ID_KEY = 'syntropi_org_id';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'superadmin' | 'admin' | 'user';
  organizationId?: string;
  organization?: {
    _id?: string;
    id?: string;
    name?: string;
  };
}

export const setAuth = (token: string, user: User) => {
  if (typeof window !== 'undefined') {
    try {
      // Store the token
      localStorage.setItem(TOKEN_KEY, token);
      
      // Extract organizationId if available
      const organizationId = extractOrganizationId(user, token);
      
      // Ensure organizationId is set on user object
      if (organizationId) {
        user.organizationId = organizationId;
        
        // Store separately for easier access
        localStorage.setItem(ORG_ID_KEY, organizationId);
        debugLog('Auth', 'Set organization ID in localStorage', { organizationId });
      }
      
      // Store user info
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      
      debugLog('Auth', 'Auth set successfully', { 
        id: user.id,
        organizationId: user.organizationId || 'none',
        role: user.role
      });
    } catch (error) {
      debugLog('Auth', 'Failed to set auth', { error }, true);
    }
  }
};

// Helper function to extract organization ID from user or token
export const extractOrganizationId = (user: User, token: string): string | null => {
  // First check direct user properties
  if (user.organizationId) {
    return user.organizationId;
  }
  
  // Then check organization object
  if (user.organization) {
    if (typeof user.organization === 'string') {
      return user.organization;
    }
    
    if (typeof user.organization === 'object') {
      return user.organization._id || user.organization.id || null;
    }
  }
  
  // Finally check token
  try {
    const decoded = jwtDecode<AuthToken>(token);
    return decoded.organizationId || null;
  } catch (error) {
    debugLog('Auth', 'Failed to decode token', { error }, true);
    return null;
  }
};

/** Update just the stored access token, e.g. after Supabase refreshes the session. */
export const setAuthToken = (token: string) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable */
    }
  }
};

export const clearAuth = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ORG_ID_KEY);
    debugLog('Auth', 'Auth cleared', {});
  }
};

export const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
};

export const getUser = (): User | null => {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem(USER_KEY);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        debugLog('Auth', 'Failed to parse user JSON', { error }, true);
      }
    }
  }
  return null;
};

export const getOrganizationId = (): string | null => {
  // First try dedicated storage
  if (typeof window !== 'undefined') {
    const orgId = localStorage.getItem(ORG_ID_KEY);
    if (orgId) {
      return orgId;
    }
  }
  
  // Then try to get from user
  const user = getUser();
  if (!user) return null;
  
  if (user.organizationId) {
    return user.organizationId;
  }
  
  // Try to extract from organization object if present
  if (user.organization) {
    if (typeof user.organization === 'object') {
      return user.organization._id || user.organization.id || null;
    }
    if (typeof user.organization === 'string') {
      return user.organization;
    }
  }
  
  return null;
};

export const isAuthenticated = (): boolean => {
  const token = getToken();
  if (!token) return false;

  try {
    const decoded = jwtDecode<AuthToken>(token);
    const currentTime = Date.now() / 1000;
    return decoded.exp > currentTime;
  } catch (error) {
    debugLog('Auth', 'Token validation error', { error }, true);
    return false;
  }
};

export const isAdmin = (): boolean => {
  const user = getUser();
  return !!user && (user.role === 'admin' || user.role === 'superadmin');
};

export const isSuperAdmin = (): boolean => {
  const user = getUser();
  return !!user && user.role === 'superadmin';
};
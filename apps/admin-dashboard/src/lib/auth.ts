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
      
      // Decode token to get organizationId if not already in user object
      if (!user.organizationId) {
        try {
          const decoded = jwtDecode<AuthToken>(token);
          if (decoded.organizationId) {
            user.organizationId = decoded.organizationId;
            debugLog('Auth', 'Added organizationId from token', { organizationId: decoded.organizationId });
          }
        } catch (error) {
          debugLog('Auth', 'Failed to decode token for organizationId', { error }, true);
        }
      }
      
      // Log what we're storing
      debugLog('Auth', 'Storing user', { 
        id: user.id,
        organizationId: user.organizationId || 'none',
        role: user.role
      });
      
      // Store user info
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
      debugLog('Auth', 'Failed to set auth', { error }, true);
    }
  }
};

export const clearAuth = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    debugLog('Auth', 'Cleared auth', {});
  }
};

export const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      return token;
    }
  }
  return null;
};

export const getUser = (): User | null => {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem(USER_KEY);
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        // Fill organizationId from token if missing in stored user
        if (!user.organizationId) {
          const token = getToken();
          if (token) {
            try {
              const decoded = jwtDecode<AuthToken>(token);
              if (decoded.organizationId) {
                user.organizationId = decoded.organizationId;
                debugLog('Auth', 'Retrieved organizationId from token', { organizationId: decoded.organizationId });
                // Update stored user with the org ID
                localStorage.setItem(USER_KEY, JSON.stringify(user));
              }
            } catch (error) {
              debugLog('Auth', 'Failed to decode token for organizationId', { error }, true);
            }
          }
        }
        return user;
      } catch (error) {
        debugLog('Auth', 'Failed to parse user JSON', { error }, true);
      }
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
    // Token expired
    if (decoded.exp <= currentTime) {
      debugLog('Auth', 'Token expired', { exp: decoded.exp, current: currentTime });
      return false;
    }
    return true;
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

// Helper to extract organization ID from user in various formats
export const getOrganizationId = (): string | null => {
    const user = getUser();
    if (!user) return null;
    
    debugLog('Auth', 'Getting organization ID', { user });
    
    // Try various ways to get organization ID
    const orgId = user.organizationId || 
           (user.organization && user.organization._id) || 
           (user.organization && user.organization.id);
    
    // Add debugging to see what we're getting
    debugLog('Auth', 'Organization ID result', { 
      orgId,
      hasOrganization: !!user.organization,
      directAccessId: user.organizationId,
      nestedId: user.organization?.id,
      nestedUnderscoreId: user.organization?._id
    });
    
    return orgId || null;
  };
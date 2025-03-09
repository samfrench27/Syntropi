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
const ORG_ID_KEY = 'syntropi_org_id'; // New key for storing org ID separately

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
      
      // Extract organizationId from various sources
      let organizationId = extractOrganizationId(user, token);
      
      // If we found an organizationId, make sure it's set on the user object
      if (organizationId) {
        user.organizationId = organizationId;
        
        // Also store it separately for emergency access
        localStorage.setItem(ORG_ID_KEY, organizationId);
        
        debugLog('Auth', 'Set organization ID in localStorage', { organizationId });
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

// Helper function to extract organization ID from user or token
const extractOrganizationId = (user: User, token: string): string | null => {
  // First try to get it directly from user object
  if (user.organizationId) {
    debugLog('Auth', 'Found organizationId directly on user', { organizationId: user.organizationId });
    return user.organizationId;
  }
  
  // Next try to get it from user.organization object
  if (user.organization) {
    if (typeof user.organization === 'string') {
      debugLog('Auth', 'Found organization as string', { organizationId: user.organization });
      return user.organization;
    }
    
    if (typeof user.organization === 'object') {
      const orgId = user.organization._id || user.organization.id;
      if (orgId) {
        debugLog('Auth', 'Found organization ID in object', { organizationId: orgId });
        return orgId;
      }
    }
  }
  
  // Finally try to get it from token
  try {
    const decoded = jwtDecode<AuthToken>(token);
    if (decoded.organizationId) {
      debugLog('Auth', 'Extracted organizationId from token', { organizationId: decoded.organizationId });
      return decoded.organizationId;
    }
  } catch (error) {
    debugLog('Auth', 'Failed to decode token for organizationId', { error }, true);
  }
  
  return null;
};

export const clearAuth = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ORG_ID_KEY);
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
        
        // Check for organizationId - look in multiple places if not found
        if (!user.organizationId) {
          // First try separate storage
          const orgId = localStorage.getItem(ORG_ID_KEY);
          if (orgId) {
            user.organizationId = orgId;
            debugLog('Auth', 'Retrieved organizationId from separate storage', { organizationId: orgId });
            
            // Update stored user with the org ID
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            return user;
          }
          
          // Then try token
          const token = getToken();
          if (token) {
            try {
              const decoded = jwtDecode<AuthToken>(token);
              if (decoded.organizationId) {
                user.organizationId = decoded.organizationId;
                debugLog('Auth', 'Retrieved organizationId from token', { organizationId: decoded.organizationId });
                
                // Save to separate storage and update user object
                localStorage.setItem(ORG_ID_KEY, decoded.organizationId);
                localStorage.setItem(USER_KEY, JSON.stringify(user));
              }
            } catch (error) {
              debugLog('Auth', 'Failed to decode token for organizationId', { error }, true);
            }
          }
        }
        
        // Check if organization is available as an object
        if (!user.organizationId && user.organization) {
          if (typeof user.organization === 'object') {
            const orgId = user.organization._id || user.organization.id;
            if (orgId) {
              user.organizationId = orgId;
              debugLog('Auth', 'Retrieved organizationId from organization object', { organizationId: orgId });
              
              // Save to separate storage and update user object
              localStorage.setItem(ORG_ID_KEY, orgId);
              localStorage.setItem(USER_KEY, JSON.stringify(user));
            }
          } else if (typeof user.organization === 'string') {
            user.organizationId = user.organization;
            debugLog('Auth', 'Retrieved organizationId from organization string', { organizationId: user.organization });
            
            // Save to separate storage and update user object
            localStorage.setItem(ORG_ID_KEY, user.organization);
            localStorage.setItem(USER_KEY, JSON.stringify(user));
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
  // First try the direct storage for org ID
  if (typeof window !== 'undefined') {
    const directOrgId = localStorage.getItem(ORG_ID_KEY);
    if (directOrgId) {
      debugLog('Auth', 'Got organization ID from direct storage', { orgId: directOrgId });
      return directOrgId;
    }
  }
  
  // Then try to get from user
  const user = getUser();
  if (!user) return null;
  
  debugLog('Auth', 'Getting organization ID from user', { user });
  
  // Try various ways to get organization ID
  const orgId = user.organizationId || 
         (user.organization && typeof user.organization === 'object' && user.organization._id) || 
         (user.organization && typeof user.organization === 'object' && user.organization.id) ||
         (typeof user.organization === 'string' ? user.organization : null);
  
  // Add debugging to see what we're getting
  debugLog('Auth', 'Organization ID result', { 
    orgId,
    hasOrganization: !!user.organization,
    directAccessId: user.organizationId,
    nestedId: user.organization && typeof user.organization === 'object' ? user.organization.id : undefined,
    nestedUnderscoreId: user.organization && typeof user.organization === 'object' ? user.organization._id : undefined
  });
  
  // If we found an org ID, store it for future use
  if (orgId && typeof window !== 'undefined') {
    localStorage.setItem(ORG_ID_KEY, orgId);
  }
  
  return orgId || null;
};
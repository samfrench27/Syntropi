// src/contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';
import { User, setAuth, clearAuth, getUser, isAuthenticated } from '@/lib/auth';
import { debugLog } from '@/lib/debug';
import { fetchUserOrganization, storeUserOrganizationId } from '@/lib/organizationFetcher';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => boolean;
  refreshUser: () => Promise<User | undefined>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  checkAuth: () => false,
  refreshUser: async () => undefined,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Function to ensure user has organizationId - improved version
const ensureOrganizationId = (userData: any): User => {
  // Extract organization ID safely with more logging
  let organizationId = null;
  
  // Log the full user data structure to understand what we're working with
  debugLog('AuthContext', 'User data structure:', { 
    userData: JSON.stringify(userData, null, 2),
    hasOrgId: !!userData.organizationId,
    hasOrg: !!userData.organization,
    orgType: userData.organization ? typeof userData.organization : 'undefined'
  });
  
  // Try direct organizationId property first
  if (userData.organizationId) {
    organizationId = userData.organizationId;
    debugLog('AuthContext', 'Using direct organizationId', { organizationId });
  }
  // Then try organization object if available
  else if (userData.organization) {
    if (typeof userData.organization === 'string') {
      organizationId = userData.organization;
      debugLog('AuthContext', 'Using organization string', { organizationId });
    } else if (typeof userData.organization === 'object') {
      // Extract id from object, handling both _id and id properties
      if (userData.organization._id) {
        organizationId = userData.organization._id;
        debugLog('AuthContext', 'Using organization._id', { organizationId });
      } else if (userData.organization.id) {
        organizationId = userData.organization.id;
        debugLog('AuthContext', 'Using organization.id', { organizationId });
      }
    }
  }
  
  // Log warning but don't show as error if no organization ID found
  if (!organizationId) {
    console.warn('[AuthContext] No organization ID found after extraction', { userData });
  } else {
    // If we found an organization ID, save it in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('syntropi_org_id', organizationId);
      debugLog('AuthContext', 'Saved organization ID to localStorage', { organizationId });
    }
  }
  
  // Return user object with organizationId
  return {
    id: userData.id || userData._id,
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    role: userData.role,
    organizationId: organizationId,
    organization: userData.organization,
  };
};


  // Function to refresh user data from the server
  const refreshUser = async () => {
    try {
      // Only attempt to refresh if we have auth token
      if (isAuthenticated()) {
        const response = await authAPI.me();
        const userData = response.data.data.user;
        
        // Ensure organization ID is properly extracted
        const updatedUser = ensureOrganizationId(userData);
        
        // Update local state
        setUser(updatedUser);
        
        // Also update local storage
        localStorage.setItem('syntropi_admin_user', JSON.stringify(updatedUser));
        
        debugLog('AuthContext', 'User refreshed successfully', { 
          id: updatedUser.id,
          organizationId: updatedUser.organizationId
        });
        
        return updatedUser;
      }
    } catch (error) {
      debugLog('AuthContext', 'Error refreshing user', { error }, true);
      throw error;
    }
  };

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      if (isAuthenticated()) {
        try {
          // Get user from local storage first
          const storedUser = getUser();
          if (storedUser) {
            // Ensure we have organization ID
            const userWithOrg = ensureOrganizationId(storedUser);
            setUser(userWithOrg);
          }
          
          // Then verify with server and update
          await refreshUser();
        } catch (error) {
          clearAuth();
          debugLog('AuthContext', 'Auth verification failed:', { error }, true);
        }
      }
      setLoading(false);
    };

    checkAuthStatus();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);
      debugLog('Auth', 'Login response received', { status: response.status });
      
      const { token, user: userData } = response.data.data;
      
      // Log the raw user data from API
      debugLog('Auth', 'Raw user data from API', { userData });
      
      // Create a basic user object from the response
      const userObj = {
        id: userData.id || userData._id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        // Organization will be added later
        organizationId: null,
        organization: null
      };
      
      // Set auth with the basic user first so we are authenticated for the next API calls
      setAuth(token, userObj);
      setUser(userObj);
      
      // For admin users, fetch organization information
      if (userData.role === 'admin') {
        debugLog('Auth', 'Admin user, fetching organization information', { userId: userObj.id });
        
        // Fetch organization in the background
        fetchUserOrganization(userObj.id).then(orgId => {
          if (orgId) {
            // Update user object with organization ID
            const updatedUser = {
              ...userObj,
              organizationId: orgId
            };
            
            // Update auth with the organization ID
            setAuth(token, updatedUser);
            setUser(updatedUser);
            
            debugLog('Auth', 'Updated user with organization ID', { 
              userId: updatedUser.id, 
              organizationId: updatedUser.organizationId 
            });
          }
        }).catch(err => {
          debugLog('Auth', 'Error fetching organization for user', { error: err }, true);
        });
      }
      
      // Log success with the processed user data
      debugLog('Auth', 'Login successful, processed user data:', {
        id: userObj.id,
        email: userObj.email,
        role: userObj.role
      });
      
      // Add a small delay before redirecting to ensure state is updated
      setTimeout(() => {
        // Redirect based on role
        if (userData.role === 'superadmin') {
          router.push('/platform-admin/dashboard');
        } else if (userData.role === 'admin') {
          router.push('/org-admin/dashboard');
        } else {
          router.push('/client/dashboard');
        }
      }, 300); // Increased delay to allow for organization fetch
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    router.push('/login');
  };

  const checkAuth = () => {
    const isAuth = isAuthenticated();
    if (!isAuth && user) {
      setUser(null);
    }
    return isAuth;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';
import { User, setAuth, clearAuth, getUser, isAuthenticated } from '@/lib/auth';
import { debugLog } from '@/lib/debug';

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

  // Function to refresh user data from the server
  const refreshUser = async () => {
    try {
      // Only attempt to refresh if we have auth token
      if (isAuthenticated()) {
        const response = await authAPI.me();
        const userData = response.data.data.user;
        
        // Extract organization id safely
        let organizationId = null;
        if (userData.organization) {
          if (typeof userData.organization === 'string') {
            organizationId = userData.organization;
          } else if (typeof userData.organization === 'object') {
            organizationId = userData.organization.id || userData.organization._id;
          }
        }
        
        // Construct a proper user object with organization ID
        const updatedUser = {
          id: userData.id,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          organizationId: organizationId,
          organization: userData.organization,
        };
        
        // Update local state
        setUser(updatedUser);
        
        // Also update local storage
        localStorage.setItem('syntropi_admin_user', JSON.stringify(updatedUser));
        
        // Store organization ID separately if available
        if (organizationId) {
          localStorage.setItem('syntropi_org_id', organizationId);
          debugLog('AuthContext', 'Updated organization ID in storage', { organizationId });
        }
        
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
            setUser(storedUser);
          }
          
          // Then try to verify with server and update
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
      const { token, user: userData } = response.data.data;
      
      // Extract organization ID more reliably
      let organizationId = null;
      
      if (userData.organizationId) {
        organizationId = userData.organizationId;
      } else if (userData.organization) {
        if (typeof userData.organization === 'string') {
          organizationId = userData.organization;
        } else if (typeof userData.organization === 'object') {
          organizationId = userData.organization.id || userData.organization._id;
        }
      }
      
      // Add organizationId directly to the user object
      const userWithOrg = {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        organizationId: organizationId,
        organization: userData.organization
      };
      
      debugLog('Auth', 'Storing user with org data', {
        user: userWithOrg, 
        organizationId
      });
      
      // Store organization ID separately
      if (organizationId && typeof window !== 'undefined') {
        localStorage.setItem('syntropi_org_id', organizationId);
      }
      
      setAuth(token, userWithOrg);
      setUser(userWithOrg);
      
      // Redirect based on role
      if (userData.role === 'superadmin') {
        router.push('/platform-admin/dashboard');
      } else if (userData.role === 'admin') {
        router.push('/org-admin/dashboard');
      } else {
        router.push('/client/dashboard');
      }
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
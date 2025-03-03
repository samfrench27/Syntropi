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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  checkAuth: () => false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      if (isAuthenticated()) {
        try {
          // Verify with server
          const response = await authAPI.me();
          const userData = response.data.data.user;
          
          // Construct a proper user object with organization ID
          const userWithOrg = {
            id: userData.id,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: userData.role,
            organizationId: userData.organization?.id || userData.organization?._id,
          };
          
          // Update local state
          setUser(userWithOrg);
        } catch (error) {
          clearAuth();
          console.error('Auth verification failed:', error);
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
      
      // Extract organization ID from the response data
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
      
      // Create proper user object with organization ID and full organization object
      const userWithOrg = {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        organizationId: organizationId,
        organization: userData.organization // Keep the full organization object too
      };
      
      // Log the user we're storing to help with debugging
      debugLog('Auth', 'Storing user with org data', {
        user: userWithOrg,
        organizationId
      });
      
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
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
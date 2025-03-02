// src/contexts/OrganizationContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useReducer } from 'react';
import { useAuth } from './AuthContext';
import api from '@/lib/api';

interface Organization {
  _id: string;
  name: string;
  plan: string;
  status: string;
  contactEmail: string;
}

interface OrganizationContextType {
  currentOrganization: Organization | null;
  loading: boolean;
  error: string | null;
  refreshOrganization: () => Promise<void>;
}

interface User {
    id: string;
    name: string;
    email: string;
    organizationId: string | null; // Add this property
    // other user properties...
  }

const OrganizationContext = createContext<OrganizationContextType>({
  currentOrganization: null,
  loading: true,
  error: null,
  refreshOrganization: async () => {},
});

export const useOrganization = () => useContext(OrganizationContext);

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganization = async () => {
    if (!user || authLoading) return;
    
    // Skip for superadmins - they don't have a primary organization
    if (user.role === 'superadmin') {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Get organization data
        // For admins and users, we fetch their specific organization
        let response;

        if ((user as any).organizationId) {
            // For regular users, get their organization
            response = await api.get(`/api/organizations/${(user as any).organizationId}`);
          } else {
            // Fallback - shouldn't happen with proper user data
            setError('No organization associated with user');
            setLoading(false);
            return;
          }
      
      setCurrentOrganization(response.data.data.organization);
    } catch (err: any) {
      console.error('Failed to fetch organization:', err);
      setError(err.response?.data?.error?.message || 'Failed to load organization data');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (!authLoading) {
      fetchOrganization();
    }
  }, [user, authLoading]);

  const refreshOrganization = async () => {
    await fetchOrganization();
  };

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        loading,
        error,
        refreshOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};
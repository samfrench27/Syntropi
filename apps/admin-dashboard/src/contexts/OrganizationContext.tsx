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
  
  // Add console logs for debugging
  console.log("Fetching organization for user:", user);
  console.log("User role:", user.role);
  console.log("User organizationId:", user.organizationId);
  
  // Skip for superadmins - they don't have a primary organization
  if (user.role === 'superadmin') {
    setLoading(false);
    return;
  }
  
  try {
    setLoading(true);
    setError(null);
    
    // Make sure user has an organizationId property
    if (!user.organizationId) {
      console.error("User has no organizationId:", user);
      setError('No organization associated with user');
      setLoading(false);
      return;
    }
    
    // For regular users, get their organization
    const response = await api.get(`/api/organizations/${user.organizationId}`);
    console.log("Organization API response:", response.data);
    
    // Make sure to set the complete organization data with stats
    setCurrentOrganization(response.data.data.organization);
    
  } catch (err) {
    console.error("Error fetching organization:", err);
    setError('Failed to fetch organization details');
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
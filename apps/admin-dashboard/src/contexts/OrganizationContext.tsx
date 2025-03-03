// src/contexts/OrganizationContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { organizationAPI } from '@/lib/api';

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
    // Skip for no user, loading auth, or superadmins (they don't have a primary organization)
    if (!user || authLoading || user?.role === 'superadmin') {
      setLoading(false);
      return;
    }
    
    console.log("Fetching organization for user:", user);
    
    try {
      setLoading(true);
      setError(null);
      
      // Get the organization based on the user's organizationId
      // This should use the user's organization ID from auth context
      const orgId = user?.organizationId || (user as any)?.organization?._id || (user as any)?.organization?.id;
      
      if (!orgId) {
        console.log("No organization ID found in user object:", user);
        throw new Error("No organization ID found for user");
      }
      
      console.log("Using organization ID:", orgId);
      
      // Get organization details using the organization API
      const response = await organizationAPI.getOrganization(orgId);
      console.log("Organization API response:", response.data);
      
      const orgData = response.data.data.organization;
      const stats = response.data.data.stats || {};
      
      setCurrentOrganization({
        ...orgData,
        stats
      });
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
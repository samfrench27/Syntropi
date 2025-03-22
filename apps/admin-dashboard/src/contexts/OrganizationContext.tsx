// src/contexts/OrganizationContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { organizationAPI } from '@/lib/api';
import { debugLog } from '@/lib/debug';

// Define the complete organization interface
interface Organization {
  _id: string;
  name: string;
  plan: string;
  status: string;
  contactEmail: string;
  billingEmail?: string;
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
  createdAt?: string;
  updatedAt?: string;
  stats?: {
    userCount: number;
    apiKeyCount: number;
  };
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
    // Skip for superadmins or when there's no user
    if (!user || user.role === 'superadmin') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Get organization directly from user context if possible
      let orgId = user.organizationId;
      
      if (!orgId) {
        debugLog('OrganizationContext', 'No organization ID in user object', { user }, true);
        setError('No organization ID found for user');
        setLoading(false);
        return;
      }
      
      debugLog('OrganizationContext', 'Fetching organization', { orgId });
      
      // Fetch the organization data
      const response = await organizationAPI.getOrganization(orgId);
      const orgData = response.data.data.organization;
      const stats = response.data.data.stats || {};
      
      setCurrentOrganization({
        ...orgData,
        stats
      });
      
      debugLog('OrganizationContext', 'Organization loaded successfully', {
        name: orgData.name
      });
      
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch organization details';
      debugLog('OrganizationContext', 'Error', { message: errorMessage }, true);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  // Effect for initial load when auth changes
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
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
  const [fetchAttempted, setFetchAttempted] = useState(false);

  const fetchOrganization = async () => {
    // Don't fetch if we've already tried and failed
    if (fetchAttempted && error) {
      debugLog('OrganizationContext', 'Skipping fetch', { reason: 'Previous attempt failed' });
      return;
    }

    // Skip for no user, loading auth, or superadmins (they don't have a primary organization)
    if (!user) {
      debugLog('OrganizationContext', 'Skipping fetch', { reason: 'No user' });
      setLoading(false);
      return;
    }

    if (authLoading) {
      debugLog('OrganizationContext', 'Skipping fetch', { reason: 'Auth loading' });
      return;
    }
    
    if (user.role === 'superadmin') {
      debugLog('OrganizationContext', 'Skipping fetch', { reason: 'User is superadmin' });
      setLoading(false);
      return;
    }
    
    debugLog('OrganizationContext', 'Fetching organization', { user });
    
    try {
      setLoading(true);
      setError(null);
      
      let response;
      let orgData;
      let stats;
      
      // Try different approaches to get organization data
      
      // Approach 1: Try using the organizationId from user object
      if (user.organizationId) {
        debugLog('OrganizationContext', 'Fetching by ID', { organizationId: user.organizationId });
        try {
          response = await organizationAPI.getOrganization(user.organizationId);
          orgData = response.data.data.organization;
          stats = response.data.data.stats || {};
          debugLog('OrganizationContext', 'Fetched by ID', { orgData, stats });
        } catch (err) {
          debugLog('OrganizationContext', 'Failed to fetch by ID', { error: err }, true);
        }
      }
      
      // Approach 2: Try using client endpoint if admin endpoint failed
      if (!orgData) {
        debugLog('OrganizationContext', 'Fetching from client endpoint', {});
        try {
          response = await organizationAPI.getCurrentOrganization();
          orgData = response.data.data.organization;
          stats = response.data.data.stats || {};
          debugLog('OrganizationContext', 'Fetched from client endpoint', { orgData, stats });
        } catch (err) {
          debugLog('OrganizationContext', 'Failed to fetch from client endpoint', { error: err }, true);
        }
      }
      
      // Approach 3: Use any available organization ID from user object
      if (!orgData && ((user as any).organization?._id || (user as any).organization?.id)) {
        const orgId = (user as any).organization?._id || (user as any).organization?.id;
        debugLog('OrganizationContext', 'Fetching by alternate ID', { organizationId: orgId });
        try {
          response = await organizationAPI.getOrganization(orgId);
          orgData = response.data.data.organization;
          stats = response.data.data.stats || {};
          debugLog('OrganizationContext', 'Fetched by alternate ID', { orgData, stats });
        } catch (err) {
          debugLog('OrganizationContext', 'Failed to fetch by alternate ID', { error: err }, true);
        }
      }
      
      // Finally, check if we got organization data
      if (orgData) {
        setCurrentOrganization({
          ...orgData,
          stats
        });
      } else {
        throw new Error('Could not retrieve organization data through any method');
      }
      
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch organization details';
      debugLog('OrganizationContext', 'Error', { message: errorMessage }, true);
      setError(errorMessage);
    } finally {
      setLoading(false);
      setFetchAttempted(true);
    }
  };
  
  // Effect for initial load and when auth changes
  useEffect(() => {
    if (!authLoading) {
      fetchOrganization();
    }
  }, [user, authLoading]);

  const refreshOrganization = async () => {
    setFetchAttempted(false); // Allow trying again even if previously failed
    await fetchOrganization();
  };

  // Debug rendering
  useEffect(() => {
    debugLog('OrganizationContext', 'State update', {
      currentOrganization,
      loading,
      error,
      user: user?.id
    });
  }, [currentOrganization, loading, error, user]);

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
// src/contexts/OrganizationContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { organizationAPI } from '@/lib/api';
import { debugLog } from '@/lib/debug';
import { getUserOrganizationId } from '@/lib/organizationFetcher';

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
      
      // First check if we already have organization data in state
      if (currentOrganization) {
        debugLog('OrganizationContext', 'Using existing organization data', {
          name: currentOrganization.name
        });
        setLoading(false);
        return;
      }
      
      // Try to load from localStorage first for immediate display
      if (typeof window !== 'undefined') {
        try {
          const storedOrg = localStorage.getItem('syntropi_organization');
          if (storedOrg) {
            const parsedOrg = JSON.parse(storedOrg);
            setCurrentOrganization(parsedOrg);
            debugLog('OrganizationContext', 'Loaded organization from localStorage', {
              name: parsedOrg.name
            });
            // Continue fetching fresh data
          }
        } catch (err) {
          debugLog('OrganizationContext', 'Error loading from localStorage', { error: err });
        }
      }
      
      // Get organization ID using the dedicated fetcher
      const orgId = await getUserOrganizationId(user.id);
      
      if (!orgId) {
        debugLog('OrganizationContext', 'No organization ID found after all attempts', { 
          userId: user.id
        }, true);
        setError('No organization ID found for user');
        setLoading(false);
        return;
      }
      
      debugLog('OrganizationContext', 'Fetching organization data', { orgId });
      
      // Fetch the organization data
      const response = await organizationAPI.getOrganization(orgId);
      const orgData = response.data.data.organization;
      const stats = response.data.data.stats || {};
      
      // Store the organization data
      const organizationData = {
        ...orgData,
        stats
      };
      
      setCurrentOrganization(organizationData);
      
      // Also store in localStorage for persistence between page navigations
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('syntropi_organization', JSON.stringify(organizationData));
          debugLog('OrganizationContext', 'Stored organization data in localStorage', {});
        } catch (err) {
          debugLog('OrganizationContext', 'Failed to store organization in localStorage', { error: err });
        }
      }
      
      debugLog('OrganizationContext', 'Organization loaded successfully', {
        name: orgData.name
      });
      
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch organization details';
      debugLog('OrganizationContext', 'Error fetching organization', { message: errorMessage }, true);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  // Effect that runs on mount and when auth state changes
  useEffect(() => {
    // Skip if still loading auth
    if (authLoading) return;
    
    // First try to load from localStorage for immediate display
    if (typeof window !== 'undefined' && !currentOrganization) {
      try {
        const storedOrg = localStorage.getItem('syntropi_organization');
        if (storedOrg) {
          const parsedOrg = JSON.parse(storedOrg);
          setCurrentOrganization(parsedOrg);
          debugLog('OrganizationContext', 'Loaded organization from localStorage', {
            name: parsedOrg.name
          });
          
          // Still fetch from server to ensure data is fresh, but we have immediate display
          fetchOrganization();
          return;
        }
      } catch (err) {
        debugLog('OrganizationContext', 'Error loading from localStorage', { error: err });
        // Continue to normal fetch if localStorage fails
      }
    }
    
    // Normal fetch path
    fetchOrganization();
  }, [user, authLoading]);

  const refreshOrganization = async () => {
    // Clear cached organization to force a fresh fetch
    if (typeof window !== 'undefined') {
      localStorage.removeItem('syntropi_organization');
    }
    setCurrentOrganization(null);
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
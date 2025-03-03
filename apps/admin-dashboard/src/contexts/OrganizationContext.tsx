// src/contexts/OrganizationContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useAuth } from './AuthContext';
import { organizationAPI } from '@/lib/api';
import { debugLog } from '@/lib/debug';
import { getOrganizationId } from '@/lib/auth';

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
  
  // Add timeout mechanism
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchingRef = useRef<boolean>(false);

  // Function to handle timeout
  const setupFetchTimeout = () => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set a new timeout - if fetch takes longer than 5 seconds, force it to complete
    timeoutRef.current = setTimeout(() => {
      if (fetchingRef.current) {
        debugLog('OrganizationContext', 'Fetch timeout reached', {}, true);
        fetchingRef.current = false;
        setLoading(false);
        setError('Timed out while fetching organization data');
      }
    }, 5000); // 5 second timeout
  };

  const fetchOrganization = async () => {
    // Don't fetch if already fetching
    if (fetchingRef.current) {
      debugLog('OrganizationContext', 'Already fetching', {});
      return;
    }
    
    // Don't fetch if we've already tried and failed
    if (fetchAttempted && error) {
      debugLog('OrganizationContext', 'Skipping fetch', { reason: 'Previous attempt failed' });
      return;
    }

    // Skip for no user or superadmins
    if (!user) {
      debugLog('OrganizationContext', 'Skipping fetch', { reason: 'No user' });
      setLoading(false);
      return;
    }
    
    if (user.role === 'superadmin') {
      debugLog('OrganizationContext', 'Skipping fetch', { reason: 'User is superadmin' });
      setLoading(false);
      return;
    }
    
    debugLog('OrganizationContext', 'Fetching organization', { user });
    
    // Mark that we're fetching and set up timeout
    fetchingRef.current = true;
    setupFetchTimeout();
    
    try {
      setLoading(true);
      setError(null);
      
      let orgData = null;
      let stats = null;
      
      // DIRECT APPROACH: First try direct method with organization ID from auth
      const orgId = getOrganizationId();
      if (orgId) {
        debugLog('OrganizationContext', 'Trying direct approach with ID', { orgId });
        
        try {
          // Try the /admin/organizations/:id endpoint
          const response = await organizationAPI.getOrganization(orgId);
          orgData = response.data.data.organization;
          stats = response.data.data.stats || {};
          debugLog('OrganizationContext', 'Direct approach succeeded', { 
            orgName: orgData.name,
            userCount: stats.userCount,
            apiKeyCount: stats.apiKeyCount
          });
        } catch (directError) {
          debugLog('OrganizationContext', 'Direct approach failed', { error: directError }, true);
        }
      }
      
      // If we got data, set it and finish
      if (orgData) {
        setCurrentOrganization({
          ...orgData,
          stats
        });
      } else {
        throw new Error('Could not retrieve organization data');
      }
      
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch organization details';
      debugLog('OrganizationContext', 'Error', { message: errorMessage }, true);
      setError(errorMessage);
    } finally {
      // Always mark that we've attempted to fetch and we're no longer fetching
      setFetchAttempted(true);
      fetchingRef.current = false;
      
      // Clear the timeout since we're done
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      setLoading(false);
    }
  };

  // Function to extract organization ID from user with detailed logging
const extractOrganizationId = (user: any): string | null => {
    if (!user) return null;
    
    // Try all possible paths for organization ID
    let orgId = null;
    
    // Direct organizationId property
    if (user.organizationId) {
      orgId = user.organizationId;
      debugLog('OrganizationContext', 'Found organizationId directly', { orgId });
      return orgId;
    }
    
    // Organization as a string (direct ID)
    if (typeof user.organization === 'string') {
      orgId = user.organization;
      debugLog('OrganizationContext', 'Found organization as string', { orgId });
      return orgId;
    }
    
    // Organization as an object
    if (user.organization && typeof user.organization === 'object') {
      // Try id property
      if (user.organization.id) {
        orgId = user.organization.id;
        debugLog('OrganizationContext', 'Found organization.id', { orgId });
        return orgId;
      }
      
      // Try _id property
      if (user.organization._id) {
        orgId = user.organization._id;
        debugLog('OrganizationContext', 'Found organization._id', { orgId });
        return orgId;
      }
    }
    
    // Log failure and return null
    debugLog('OrganizationContext', 'Failed to extract organization ID', { 
      user,
      hasOrganizationField: !!user.organization,
      organizationFieldType: typeof user.organization
    }, true);
    
    return null;
  };
  
  // Effect for initial load and when auth changes
  useEffect(() => {
    if (!authLoading) {
      fetchOrganization();
    }
    
    // Clean up timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user, authLoading]);

  const refreshOrganization = async () => {
    setFetchAttempted(false); // Allow trying again even if previously failed
    await fetchOrganization();
  };

  // Debug rendering
  useEffect(() => {
    debugLog('OrganizationContext', 'State update', {
      hasOrganization: !!currentOrganization,
      loading,
      error,
      userId: user?.id
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
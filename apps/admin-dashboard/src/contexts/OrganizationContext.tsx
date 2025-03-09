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

const ORG_STORAGE_KEY = 'emergency_org_id';

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading, refreshUser } = useAuth();
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
    
    // Don't fetch if we've already tried and failed and no force refresh
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
      
      // First try getting org ID from localStorage emergency storage
      let orgId = localStorage.getItem(ORG_STORAGE_KEY);
      if (orgId) {
        debugLog('OrganizationContext', 'Using org ID from emergency storage', { orgId });
        
        try {
          const response = await organizationAPI.getOrganization(orgId);
          orgData = response.data.data.organization;
          stats = response.data.data.stats || {};
          
          debugLog('OrganizationContext', 'Successfully loaded organization from storage ID', {
            name: orgData.name 
          });
        } catch (err) {
          debugLog('OrganizationContext', 'Failed to load from storage ID, will try other methods', { error: err });
          // Clear invalid storage ID
          localStorage.removeItem(ORG_STORAGE_KEY);
          orgId = null;
        }
      }
      
      // If we don't have org data yet, try getting from auth lib
      if (!orgData) {
        orgId = getOrganizationId();
        
        if (orgId) {
          debugLog('OrganizationContext', 'Using org ID from auth lib', { orgId });
          
          try {
            const response = await organizationAPI.getOrganization(orgId);
            orgData = response.data.data.organization;
            stats = response.data.data.stats || {};
            
            // Store for future emergency use
            localStorage.setItem(ORG_STORAGE_KEY, orgId);
            
            debugLog('OrganizationContext', 'Successfully loaded organization from auth ID', {
              name: orgData.name 
            });
          } catch (err) {
            debugLog('OrganizationContext', 'Failed to load from auth ID', { error: err });
          }
        }
      }
      
      // If still no org data, try refreshing user and getting the organization ID
      if (!orgData) {
        try {
          debugLog('OrganizationContext', 'Attempting to refresh user to get org ID', {});
          await refreshUser();
          
          // Try again with the refreshed user
          orgId = getOrganizationId();
          
          if (orgId) {
            debugLog('OrganizationContext', 'Using org ID from refreshed user', { orgId });
            
            const response = await organizationAPI.getOrganization(orgId);
            orgData = response.data.data.organization;
            stats = response.data.data.stats || {};
            
            // Store for future emergency use
            localStorage.setItem(ORG_STORAGE_KEY, orgId);
            
            debugLog('OrganizationContext', 'Successfully loaded organization after user refresh', {
              name: orgData.name 
            });
          }
        } catch (refreshErr) {
          debugLog('OrganizationContext', 'Failed to refresh user', { error: refreshErr });
        }
      }
      
      // If we finally have the organization data, set it
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
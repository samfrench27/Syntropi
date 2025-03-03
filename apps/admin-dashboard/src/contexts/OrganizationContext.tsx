// src/contexts/OrganizationContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
      
      // Skip for superadmins - they don't have a primary organization
      if (user.role === 'superadmin') {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        // Since the user doesn't have organizationId directly, we need an alternative approach
        
        // Option 1: Use a dedicated endpoint that gets the organization for the current user
        // This approach doesn't require the organizationId to be in the user object
        try {
          const response = await api.get('/api/organizations/me');
          console.log("Organization API response:", response.data);
          setCurrentOrganization(response.data.data.organization);
        } catch (orgError) {
          // Fallback to Option 2 if the /me endpoint doesn't exist
          console.log("Falling back to user organizations search");
          
          // Option 2: Get all organizations the user is associated with
          const orgsResponse = await api.get('/api/organizations', { 
            params: { limit: 1 } // Just get the first one for now
          });
          
          if (orgsResponse.data.data.organizations && 
              orgsResponse.data.data.organizations.length > 0) {
            // Use the first organization
            setCurrentOrganization(orgsResponse.data.data.organizations[0]);
          } else {
            throw new Error('No organizations found for user');
          }
        }
      } catch (err) {
        console.error("Error fetching organization:", err);
        setError('Failed to fetch organization details');
      } finally {
        setLoading(false);
      }
    };
    
    useEffect(() => {
      if (!authLoading && user) {
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

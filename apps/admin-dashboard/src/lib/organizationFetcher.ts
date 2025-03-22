// src/lib/organizationFetcher.ts
import { debugLog } from './debug';
import { userAPI } from './api';

/**
 * This utility handles fetching and storing organization information
 * for users when it's not directly available in the auth response
 */

// Default organization ID for emergency situations
let cachedOrgId: string | null = null;

/**
 * Fetch the user's organization ID directly from the API
 * This is used when the login response doesn't include organization info
 */
export const fetchUserOrganization = async (userId: string): Promise<string | null> => {
  try {
    debugLog('OrgFetcher', 'Fetching user details to get organization', { userId });
    
    // Fetch detailed user information including organization
    const response = await userAPI.getUser(userId);
    const userData = response.data.data.user;
    
    debugLog('OrgFetcher', 'User data received', { 
      hasOrg: !!userData.organization,
      orgType: userData.organization ? typeof userData.organization : 'undefined'
    });
    
    // Extract organization ID from response
    let organizationId = null;
    
    if (userData.organizationId) {
      organizationId = userData.organizationId;
    } else if (userData.organization) {
      // Handle organization as string or object
      if (typeof userData.organization === 'string') {
        organizationId = userData.organization;
      } else if (typeof userData.organization === 'object') {
        organizationId = userData.organization._id || userData.organization.id;
      }
    }
    
    if (organizationId) {
      debugLog('OrgFetcher', 'Found organization ID', { organizationId });
      
      // Store in localStorage for future reference
      if (typeof window !== 'undefined') {
        localStorage.setItem('syntropi_org_id', organizationId);
        debugLog('OrgFetcher', 'Saved organization ID to localStorage', { organizationId });
      }
      
      // Also cache in memory for immediate access
      cachedOrgId = organizationId;
      
      return organizationId;
    } else {
      debugLog('OrgFetcher', 'No organization found in user data', { userData }, true);
      return null;
    }
  } catch (error) {
    debugLog('OrgFetcher', 'Error fetching user organization', { error }, true);
    return null;
  }
};

/**
 * Get the user's organization ID using all available methods
 * This tries multiple sources in order of reliability
 */
export const getUserOrganizationId = async (userId: string): Promise<string | null> => {
  // First try localStorage
  if (typeof window !== 'undefined') {
    const storedOrgId = localStorage.getItem('syntropi_org_id');
    if (storedOrgId) {
      debugLog('OrgFetcher', 'Found organization ID in localStorage', { organizationId: storedOrgId });
      return storedOrgId;
    }
  }
  
  // Then try the in-memory cache
  if (cachedOrgId) {
    debugLog('OrgFetcher', 'Using cached organization ID', { organizationId: cachedOrgId });
    return cachedOrgId;
  }
  
  // Finally, fetch from API
  return await fetchUserOrganization(userId);
};

/**
 * Store an organization ID for a user
 */
export const storeUserOrganizationId = (organizationId: string): void => {
  if (!organizationId) return;
  
  // Store in memory
  cachedOrgId = organizationId;
  
  // Store in localStorage if available
  if (typeof window !== 'undefined') {
    localStorage.setItem('syntropi_org_id', organizationId);
    debugLog('OrgFetcher', 'Stored organization ID', { organizationId });
  }
};
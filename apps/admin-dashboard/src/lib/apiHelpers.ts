// src/lib/apiHelpers.ts
import { debugLog } from './debug';

/**
 * Helper function to extract organization ID from API responses
 * This is useful to standardize how we extract organizational information
 */
export const extractOrganizationFromResponse = (userData: any) => {
  let organizationId = null;
  let organizationData = null;
  
  // Try to extract organization ID from user data
  if (userData.organizationId) {
    organizationId = userData.organizationId;
    debugLog('ApiHelper', 'Found direct organizationId', { organizationId });
  } 
  
  // Try to get organization from organization object
  if (userData.organization) {
    if (typeof userData.organization === 'string') {
      organizationId = userData.organization;
      debugLog('ApiHelper', 'Found organization as string', { organizationId });
    } else if (typeof userData.organization === 'object') {
      organizationData = userData.organization;
      organizationId = userData.organization._id || userData.organization.id;
      debugLog('ApiHelper', 'Found organization as object', { 
        organizationId,
        name: organizationData.name || 'unknown'
      });
    }
  }
  
  // Return the extracted data
  return {
    organizationId,
    organizationData
  };
};

/**
 * Function to ensure we consistently handle API errors
 */
export const handleApiError = (error: any, defaultMessage: string = 'An error occurred') => {
  let errorMessage = defaultMessage;
  
  // Try to extract error message from response
  if (error.response?.data?.error?.message) {
    errorMessage = error.response.data.error.message;
  } else if (error.message) {
    errorMessage = error.message;
  }
  
  // Log the error
  debugLog('ApiError', errorMessage, { error }, true);
  
  return errorMessage;
};
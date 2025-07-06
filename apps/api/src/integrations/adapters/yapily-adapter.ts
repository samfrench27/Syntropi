// src/integrations/adapters/yapily-adapter.ts
import axios from 'axios';
import { winstonLogger as logger } from '../../utils/logger';
import { cleanBankName } from '../../utils/stringUtils';

// Type definitions for Yapily API responses
interface YapilyInstitutionsResponse {
  meta: {
    tracingId: string;
    count: number;
    pagination: {
      totalCount: number;
    };
  };
  data: YapilyInstitution[];
}

interface YapilyInstitution {
  id: string;
  name: string;
  fullName: string;
  countries: Array<{
    displayName: string;
    countryCode2: string;
  }>;
  environmentType: string;
  credentialsType: string;
  media: Array<{
    source: string;
    type: 'icon' | 'logo';
  }>;
  features: string[];
}

// Map Yapily features to our standardized features
function mapYapilyFeatures(features: string[]) {
  return {
    accountList: features.includes('ACCOUNTS') || features.includes('ACCOUNT'),
    accountDetails: features.includes('ACCOUNT'),
    accountBalance: features.includes('ACCOUNT_BALANCES'),
    transactionList: features.includes('ACCOUNT_TRANSACTIONS'),
    transactionDetails: features.includes('ACCOUNT_TRANSACTIONS'),
    singlePayment: features.includes('CREATE_DOMESTIC_SINGLE_PAYMENT') || features.includes('INITIATE_DOMESTIC_SINGLE_PAYMENT'),
    scheduledPayment: features.includes('CREATE_DOMESTIC_SCHEDULED_PAYMENT') || features.includes('INITIATE_DOMESTIC_SCHEDULED_PAYMENT'),
    standingOrder: features.includes('CREATE_DOMESTIC_PERIODIC_PAYMENT') || features.includes('INITIATE_DOMESTIC_PERIODIC_PAYMENT'),
    fundsConfirmation: features.includes('VARIABLE_RECURRING_PAYMENT_FUNDS_CONFIRMATION')
  };
}

// Map Yapily payment capabilities to our standardized payment methods
function mapPaymentMethods(features: string[]): string[] {
  const paymentMethods: string[] = [];
  
  if (features.includes('CREATE_DOMESTIC_SINGLE_PAYMENT')) {
    paymentMethods.push('faster_payments');
  }
  
  if (features.includes('CREATE_INTERNATIONAL_SINGLE_PAYMENT')) {
    paymentMethods.push('sepa', 'swift');
  }
  
  // Default to faster_payments for UK institutions if they support any payment
  if (features.some(f => f.includes('PAYMENT')) && paymentMethods.length === 0) {
    paymentMethods.push('faster_payments');
  }
  
  return paymentMethods;
}

// Generate a friendly bank ID in the format gb-[bankname]
export function generateFriendlyBankId(institution: YapilyInstitution): string {
  // Clean the institution name and convert to lowercase
  const cleanName = cleanBankName(institution.name)
    .toLowerCase()
    // Replace spaces and special characters with hyphens
    .replace(/[^a-z0-9]+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Collapse multiple hyphens into one
    .replace(/-+/g, '-');
  
  // Determine country code (default to GB for UK institutions)
  const countryCode = institution.countries.find(c => c.countryCode2 === 'GB') ? 'gb' : 
                     institution.countries[0]?.countryCode2?.toLowerCase() || 'gb';
  
  // Handle sandbox/test environments
  if (institution.environmentType === 'SANDBOX' || institution.name.toLowerCase().includes('sandbox')) {
    return `${countryCode}-${cleanName}-sandbox`;
  }
  
  return `${countryCode}-${cleanName}`;
}

// Fetch institutions from Yapily API
export const getBanks = async () => {
  try {
    logger.info('Fetching institutions from Yapily API');
    
    // Get Yapily credentials from environment
    const clientId = process.env.YAPILY_CLIENT_ID || '52d940e5-8efe-4143-8f3c-abe5e57ee77c';
    const clientSecret = process.env.YAPILY_CLIENT_SECRET || 'Z0mpElJpYg64o8VeSJiZqIzzmIopCPTX';
    
    if (!clientId || !clientSecret) {
      logger.error('Yapily credentials not found in environment variables');
      return [];
    }
    
    // Create basic auth header
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await axios.get<YapilyInstitutionsResponse>('https://api.yapily.com/institutions', {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Filter for GB institutions only and exclude sandbox unless in development
    const gbInstitutions = response.data.data.filter(institution => {
      const hasGBCountry = institution.countries.some(country => country.countryCode2 === 'GB');
      // Include sandbox institutions in development/staging, exclude in production
      const isSandbox = institution.environmentType === 'SANDBOX';
      const includeSandbox = process.env.NODE_ENV !== 'production';
      
      return hasGBCountry && (!isSandbox || includeSandbox);
    });
    
    logger.info(`Fetched ${gbInstitutions.length} GB institutions from Yapily API`);
    
    // Convert to our standardized format
    return gbInstitutions.map(institution => {
      const features = mapYapilyFeatures(institution.features);
      const logo = institution.media.find(m => m.type === 'logo')?.source || 
                   institution.media.find(m => m.type === 'icon')?.source;
      
      return {
        id: generateFriendlyBankId(institution),
        originalId: institution.id,
        name: cleanBankName(institution.fullName || institution.name),
        country: 'GB',
        logoUrl: logo,
        supportedPaymentMethods: mapPaymentMethods(institution.features),
        metadata: {
          environmentType: institution.environmentType,
          credentialsType: institution.credentialsType,
          supportedFeatures: features,
          allFeatures: institution.features,
          originalProviderId: institution.id
        }
      };
    });
  } catch (error) {
    logger.error('Error fetching institutions from Yapily API', error);
    // Don't throw the error, just return empty array so that the sync process can continue with other providers
    return [];
  }
};
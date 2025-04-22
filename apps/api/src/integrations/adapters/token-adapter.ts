// src/integrations/adapters/token-adapter.ts
import axios from 'axios';
import { winstonLogger as logger } from '../../utils/logger';
import { cleanBankName } from '../../utils/stringUtils';

// Type definitions for Token.io API responses
interface TokenBankResponse {
  banks: TokenBank[];
  paging: {
    page: number;
    perPage: number;
    pageCount: number;
  };
}

interface TokenBank {
  id: string;
  bic: string;
  name: string;
  logoUri: string;
  countries: string[];
  openBankingStandard?: string;
  supportedLocalInstruments: string[];
  supportsAccountList: boolean;
  supportsAccountDetails: boolean;
  supportsAccountBalance: boolean;
  supportsTransactionList: boolean;
  supportsTransactionDetails: boolean;
  supportsSinglePayment: boolean;
  supportsScheduledPayment?: boolean;
  supportsStandingOrder?: boolean;
  supportsFundsConfirmation?: boolean;
  rank?: number;
  scaMethods?: string[];
  bankGroup?: string;
  // There are more fields but we don't need them all for our mapping
}

// Map Token's payment methods to our standardized payment methods
function mapPaymentMethods(supportedLocalInstruments: string[]): string[] {
  const paymentMethodMap: Record<string, string> = {
    'FASTER_PAYMENTS': 'faster_payments',
    'CHAPS': 'chaps',
    'SEPA': 'sepa',
    'SEPA_INSTANT': 'sepa_instant',
    'SEPA_CREDIT_TRANSFER': 'sepa'
  };

  return supportedLocalInstruments
    .map(instrument => paymentMethodMap[instrument] || instrument.toLowerCase())
    .filter(method => method); // Filter out undefined values
}

// Generate a friendly bank ID in the format gb-[bankname]
export function generateFriendlyBankId(bank: TokenBank): string {
  // Clean the bank name and convert to lowercase
  const cleanName = cleanBankName(bank.name)
    .toLowerCase()
    // Replace spaces and special characters with hyphens
    .replace(/[^a-z0-9]+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Collapse multiple hyphens into one
    .replace(/-+/g, '-');
  
  // Add country code prefix
  const countryCode = 'gb';
  
  // Handle business accounts
  const isBusiness = bank.name.toLowerCase().includes('business') || 
                     bank.name.toLowerCase().includes('commercial') ||
                     bank.name.toLowerCase().includes('corporate');
  
  // Create the ID
  let friendlyId = `${countryCode}-${cleanName}`;
  
  // Add business suffix if applicable, but only if it's not already ending with business
  if (isBusiness && !cleanName.endsWith('business')) {
    friendlyId += '-business';
  }
  
  return friendlyId;
}

// Fetch banks from Token.io API
export const getBanks = async () => {
  try {
    logger.info('Fetching banks from Token.io API - GB only');
    
    // Get banks for GB only
    const country = 'GB';
    const allBanks: TokenBank[] = [];
    
    // Only fetch GB banks
    const response = await axios.get<TokenBankResponse>(`https://api.token.io/v2/banks?countries=${country}`);
    allBanks.push(...response.data.banks);
    
    logger.info(`Fetched ${allBanks.length} banks from GB`);
    
    // Convert to our standardized format
    return allBanks.map(bank => ({
      id: generateFriendlyBankId(bank),
      originalId: bank.id, // Keep original ID for reference
      name: cleanBankName(bank.name),
      // Make sure all banks are set to GB country code
      country: 'GB',
      logoUrl: bank.logoUri,
      supportedPaymentMethods: mapPaymentMethods(bank.supportedLocalInstruments || []),
      metadata: {
        bic: bank.bic,
        openBankingStandard: bank.openBankingStandard,
        bankGroup: bank.bankGroup ? cleanBankName(bank.bankGroup) : undefined,
        supportedFeatures: {
          accountList: bank.supportsAccountList,
          accountDetails: bank.supportsAccountDetails,
          accountBalance: bank.supportsAccountBalance,
          transactionList: bank.supportsTransactionList,
          transactionDetails: bank.supportsTransactionDetails,
          singlePayment: bank.supportsSinglePayment,
          scheduledPayment: bank.supportsScheduledPayment,
          standingOrder: bank.supportsStandingOrder,
          fundsConfirmation: bank.supportsFundsConfirmation
        },
        rank: bank.rank,
        scaMethods: bank.scaMethods,
        originalProviderId: bank.id // Store the original provider ID
      }
    }));
  } catch (error) {
    logger.error('Error fetching banks from Token.io', error);
    // Don't throw the error, just return empty array so that the sync process can continue with other providers
    return [];
  }
};
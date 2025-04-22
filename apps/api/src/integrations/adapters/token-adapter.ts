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

// Fetch banks from Token.io API
export const getBanks = async () => {
  try {
    logger.info('Fetching banks from Token.io API');
    
    // Get banks for multiple countries
    const countries = ['GB', 'DE', 'FR', 'ES', 'IT', 'NL'];
    const allBanks: TokenBank[] = [];
    
    for (const country of countries) {
      const response = await axios.get<TokenBankResponse>(`https://api.token.io/v2/banks?countries=${country}`);
      allBanks.push(...response.data.banks);
    }
    
    // Convert to our standardized format
    return allBanks.map(bank => ({
      id: bank.id,
      name: cleanBankName(bank.name),
      // Take the first country as primary, or default to 'UNKNOWN'
      country: bank.countries && bank.countries.length > 0 ? bank.countries[0] : 'UNKNOWN',
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
        scaMethods: bank.scaMethods
      }
    }));
  } catch (error) {
    logger.error('Error fetching banks from Token.io', error);
    // Don't throw the error, just return empty array so that the sync process can continue with other providers
    return [];
  }
};
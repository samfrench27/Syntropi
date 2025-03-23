// apps/api/src/services/stubbed-bank.service.ts
import { createError } from '../middleware/errorHandler';

// Define interfaces for our mock data structure
interface ProviderMapping {
  providerId: string;
  supportedPaymentMethods: string[];
  lastUpdated: Date;
  active: boolean;
  metadata?: any;
}

interface MockBank {
  id: string;
  name: string;
  country: string;
  logoUrl: string;
  supportedPaymentMethods: string[];
  providerMappings: {
    [key: string]: ProviderMapping;
  };
  active?: boolean;
}

// Mock data for stubbed bank service
const mockBanks: MockBank[] = [
  {
    id: 'bank_001',
    name: 'National Bank of Test',
    country: 'GB',
    logoUrl: 'https://example.com/logos/national-bank.png',
    supportedPaymentMethods: ['sepa', 'faster_payments', 'chaps'],
    providerMappings: {
      token: {
        providerId: 'token_bank_001',
        supportedPaymentMethods: ['sepa', 'faster_payments'],
        lastUpdated: new Date(),
        active: true
      },
      yapily: {
        providerId: 'yapily_bank_001',
        supportedPaymentMethods: ['sepa', 'faster_payments', 'chaps'],
        lastUpdated: new Date(),
        active: true
      }
    }
  },
  {
    id: 'bank_002',
    name: 'European Test Bank',
    country: 'DE',
    logoUrl: 'https://example.com/logos/european-bank.png',
    supportedPaymentMethods: ['sepa', 'instant_sepa'],
    providerMappings: {
      token: {
        providerId: 'token_bank_002',
        supportedPaymentMethods: ['sepa'],
        lastUpdated: new Date(),
        active: true
      },
      truelayer: {
        providerId: 'truelayer_bank_002',
        supportedPaymentMethods: ['sepa', 'instant_sepa'],
        lastUpdated: new Date(),
        active: true
      }
    }
  },
  {
    id: 'bank_003',
    name: 'Nordic Bank Test',
    country: 'SE',
    logoUrl: 'https://example.com/logos/nordic-bank.png',
    supportedPaymentMethods: ['sepa', 'swish'],
    providerMappings: {
      tink: {
        providerId: 'tink_bank_003',
        supportedPaymentMethods: ['swish'],
        lastUpdated: new Date(),
        active: true
      }
    }
  },
  {
    id: 'bank_004', 
    name: 'American Test Bank',
    country: 'US',
    logoUrl: 'https://example.com/logos/american-bank.png',
    supportedPaymentMethods: ['ach', 'wire'],
    providerMappings: {
      token: {
        providerId: 'token_bank_004',
        supportedPaymentMethods: ['ach', 'wire'],
        lastUpdated: new Date(),
        active: true
      }
    }
  },
  {
    id: 'bank_005',
    name: 'Financial Trust Test',
    country: 'GB',
    logoUrl: 'https://example.com/logos/financial-trust.png',
    supportedPaymentMethods: ['faster_payments', 'bacs'],
    providerMappings: {
      yapily: {
        providerId: 'yapily_bank_005',
        supportedPaymentMethods: ['faster_payments', 'bacs'],
        lastUpdated: new Date(),
        active: true
      }
    }
  }
];

// Interface for filter parameters
interface BankFilters {
  country?: string;
  provider?: string;
  paymentMethod?: string;
  search?: string;
}

// Get supported providers
export const getSupportedProviders = (): string[] => {
  return ['token', 'yapily', 'truelayer', 'tink'];
};

// Get banks with filtering (stubbed implementation)
export const getBanks = async (filters: BankFilters = {}, page = 1, limit = 100) => {
  // Apply filters to the mock data
  let filteredBanks = [...mockBanks];
  
  // Country filter
  if (filters.country) {
    filteredBanks = filteredBanks.filter(bank => 
      bank.country.toUpperCase() === filters.country!.toUpperCase()
    );
  }
  
  // Provider filter
  if (filters.provider) {
    filteredBanks = filteredBanks.filter(bank => {
      const providerMapping = bank.providerMappings[filters.provider!];
      return providerMapping && providerMapping.active;
    });
  }
  
  // Payment method filter
  if (filters.paymentMethod) {
    filteredBanks = filteredBanks.filter(bank => 
      bank.supportedPaymentMethods.includes(filters.paymentMethod!)
    );
  }
  
  // Search filter (simple case-insensitive name search)
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filteredBanks = filteredBanks.filter(bank => 
      bank.name.toLowerCase().includes(searchLower)
    );
  }
  
  // Calculate pagination
  const total = filteredBanks.length;
  const skip = (page - 1) * limit;
  const paginatedBanks = filteredBanks.slice(skip, skip + limit);
  
  return {
    banks: paginatedBanks,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

// Get a specific bank by ID
export const getBank = async (bankId: string): Promise<MockBank> => {
  const bank = mockBanks.find(bank => bank.id === bankId);
  
  if (!bank) {
    throw createError('Bank not found', 404);
  }
  
  return bank;
};

// Simulate bank synchronization for testing
export const syncBanksFromProviders = async (providers?: string[]): Promise<Record<string, any>> => {
  const providerList = providers || getSupportedProviders();
  const results: Record<string, any> = {};
  
  for (const provider of providerList) {
    // Simulate sync results with random numbers
    const created = Math.floor(Math.random() * 5);
    const updated = Math.floor(Math.random() * 10);
    const skipped = Math.floor(Math.random() * 3);
    
    results[provider] = { 
      created, 
      updated, 
      skipped, 
      total: created + updated + skipped 
    };
  }
  
  return results;
};

// Get a bank's provider-specific ID
export const getBankProviderInfo = async (bankId: string, provider: string) => {
  const bank = mockBanks.find(bank => bank.id === bankId);
  
  if (!bank) {
    throw createError('Bank not found', 404);
  }
  
  const providerMapping = bank.providerMappings[provider];
  if (!providerMapping || !providerMapping.active) {
    throw createError(`Bank is not available with provider: ${provider}`, 400);
  }
  
  return {
    providerId: providerMapping.providerId,
    supportedPaymentMethods: providerMapping.supportedPaymentMethods,
    metadata: providerMapping.metadata
  };
};
// apps/api/src/services/bank.service.ts
import { Bank } from '../models/bank.model';
import { createError } from '../middleware/errorHandler';
import * as tokenAdapter from '../integrations/adapters/token-adapter';
import * as yapilyAdapter from '../integrations/adapters/yapily-adapter';
import * as truelayerAdapter from '../integrations/adapters/truelayer-adapter';
import * as tinkAdapter from '../integrations/adapters/tink-adapter';
import { winstonLogger as logger } from '../utils/logger';

// Interface for standardized bank info across providers
interface StandardizedBankInfo {
  name: string;
  country: string;
  logoUrl?: string;
  supportedPaymentMethods: string[];
  metadata?: any;
}

// Get the appropriate adapter for a provider
const getProviderAdapter = (provider: string) => {
  switch (provider) {
    case 'token':
      return tokenAdapter;
    case 'yapily':
      return yapilyAdapter;
    case 'truelayer':
      return truelayerAdapter;
    case 'tink':
      return tinkAdapter;
    default:
      throw createError(`Unsupported provider: ${provider}`, 400);
  }
};

// Get all supported providers
export const getSupportedProviders = () => {
  return ['token', 'yapily', 'truelayer', 'tink'];
};

// Fetch banks from a specific provider
export const fetchBanksFromProvider = async (provider: string): Promise<{[bankId: string]: StandardizedBankInfo}> => {
  try {
    const adapter = getProviderAdapter(provider);
    const providerBanks: Array<{
      id: string;
      name: string;
      country: string;
      logoUrl?: string;
      supportedPaymentMethods: string[];
      metadata?: any;
    }> = await adapter.getBanks();
    
    // Standardize bank information
    const standardizedBanks: {[bankId: string]: StandardizedBankInfo} = {};
    
    for (const bank of providerBanks) {
      standardizedBanks[bank.id] = {
        name: bank.name,
        country: bank.country,
        logoUrl: bank.logoUrl,
        supportedPaymentMethods: bank.supportedPaymentMethods,
        metadata: bank.metadata
      };
    }
    
    return standardizedBanks;
  } catch (error) {
    logger.error(`Error fetching banks from ${provider}:`, error);
    throw error;
  }
};

// Sync banks from all providers to our database
export const syncBanksFromProviders = async (providers?: string[]): Promise<any> => {
  const providerList = providers || getSupportedProviders();
  const results: any = {};
  
  for (const provider of providerList) {
    try {
      logger.info(`Syncing banks from ${provider}...`);
      const providerBanks = await fetchBanksFromProvider(provider);
      
      // Track stats
      let created = 0;
      let updated = 0;
      let skipped = 0;
      
      // Process each bank
      for (const [providerId, bankInfo] of Object.entries(providerBanks)) {
        // Look for existing bank by name and country (potential match)
        let existingBank = await Bank.findOne({
          [`providerMappings.${provider}.providerId`]: providerId
        });
        
        if (!existingBank) {
          // Try to find by name and country as a fuzzy match
          existingBank = await Bank.findOne({
            name: { $regex: new RegExp(`^${bankInfo.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            country: bankInfo.country
          });
        }
        
        if (existingBank) {
          // Ensure providerMappings is initialized
          if (!existingBank.providerMappings) {
            existingBank.providerMappings = {};
          }
          
          // Update existing bank's provider mapping
          existingBank.providerMappings[provider] = {
            providerId,
            supportedPaymentMethods: bankInfo.supportedPaymentMethods,
            lastUpdated: new Date(),
            active: true,
            metadata: bankInfo.metadata
          };
          
          // Update the bank's overall supported payment methods
          const allMethods = new Set([
            ...(existingBank.supportedPaymentMethods || []),
            ...bankInfo.supportedPaymentMethods
          ]);
          existingBank.supportedPaymentMethods = Array.from(allMethods);
          
          // Update logo if none exists
          if (!existingBank.logoUrl && bankInfo.logoUrl) {
            existingBank.logoUrl = bankInfo.logoUrl;
          }
          
          await existingBank.save();
          updated++;
        } else {
          // Create new bank
          const newBank = new Bank({
            name: bankInfo.name,
            country: bankInfo.country,
            logoUrl: bankInfo.logoUrl,
            supportedPaymentMethods: bankInfo.supportedPaymentMethods,
            active: true,
            providerMappings: {
              [provider]: {
                providerId,
                supportedPaymentMethods: bankInfo.supportedPaymentMethods,
                lastUpdated: new Date(),
                active: true,
                metadata: bankInfo.metadata
              }
            }
          });
          
          await newBank.save();
          created++;
        }
      }
      
      // Find banks with provider mappings that weren't updated
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - 1); // 1 hour ago
      
      const outdatedBanks = await Bank.find({
        [`providerMappings.${provider}.active`]: true,
        [`providerMappings.${provider}.lastUpdated`]: { $lt: cutoffDate }
      });
      
      // Deactivate outdated provider mappings
      for (const bank of outdatedBanks) {
        if (bank.providerMappings && bank.providerMappings[provider]) {
          bank.providerMappings[provider].active = false;
          await bank.save();
          skipped++;
        }
      }
      
      results[provider] = { created, updated, skipped, total: created + updated + skipped };
    } catch (error) {
      logger.error(`Error syncing banks from ${provider}:`, error);
      results[provider] = { error: (error as Error).message };
    }
  }
  
  return results;
};

// Get banks with filtering
export const getBanks = async (filters: any = {}, page = 1, limit = 100) => {
  const query: any = { active: true };
  
  // Always filter for GB banks only
  query.country = 'GB';
  
  // Apply additional filters
  if (filters.provider) {
    query[`providerMappings.${filters.provider}.active`] = true;
  }
  
  if (filters.paymentMethod) {
    query.supportedPaymentMethods = filters.paymentMethod;
  }
  
  if (filters.search) {
    query.$text = { $search: filters.search };
  }
  
  // Calculate pagination
  const skip = (page - 1) * limit;
  
  // Get banks
  const banks = await Bank.find(query)
    .sort({ name: 1 })
    .skip(skip)
    .limit(limit);
  
  // Get total count
  const total = await Bank.countDocuments(query);
  
  return {
    banks,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

// Get a specific bank
export const getBank = async (bankId: string) => {
  const bank = await Bank.findById(bankId);
  
  if (!bank || !bank.active) {
    throw createError('Bank not found', 404);
  }
  
  return bank;
};

// Get a bank's provider-specific ID
export const getBankProviderInfo = async (bankId: string, provider: string) => {
  const bank = await Bank.findById(bankId);
  
  if (!bank || !bank.active) {
    throw createError('Bank not found', 404);
  }
  
  if (!bank.providerMappings || !bank.providerMappings[provider] || !bank.providerMappings[provider].active) {
    throw createError(`Bank is not available with provider: ${provider}`, 400);
  }
  
  return {
    providerId: bank.providerMappings[provider].providerId,
    supportedPaymentMethods: bank.providerMappings[provider].supportedPaymentMethods,
    metadata: bank.providerMappings[provider].metadata
  };
};

// Cleanup function to remove banks from non-GB countries
export const cleanupNonGBBanks = async () => {
  try {
    logger.info('Cleaning up non-GB banks from database');
    const result = await Bank.deleteMany({ country: { $ne: 'GB' } });
    logger.info(`Deleted ${result.deletedCount} non-GB banks`);
    return result.deletedCount;
  } catch (error) {
    logger.error('Error cleaning up non-GB banks:', error);
    throw error;
  }
};
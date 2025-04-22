// apps/api/src/controllers/public/bank.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as bankService from '../../services/bank.service';
import { createError } from '../../middleware/errorHandler';

// Helper function to simplify bank data for client response
const simplifyBankData = (bank: any) => {
  return {
    id: bank.syntropi_id || bank._id.toString(), // Prefer syntropi_id, fall back to MongoDB ID
    name: bank.name,
    country: bank.country,
    logoUrl: bank.logoUrl,
    supportedPaymentMethods: bank.supportedPaymentMethods || [],
    active: bank.active,
    // Only include relevant metadata, not provider-specific details
    features: bank.providerMappings ? {
      accountAccess: getFeatureSupport(bank, 'accountList'),
      accountBalance: getFeatureSupport(bank, 'accountBalance'),
      transactions: getFeatureSupport(bank, 'transactionList'),
      payments: getFeatureSupport(bank, 'singlePayment')
    } : {}
  };
};

// Helper to check if any provider supports a feature
const getFeatureSupport = (bank: any, feature: string) => {
  if (!bank.providerMappings) return false;
  
  // Check if any provider supports the feature
  return Object.values(bank.providerMappings).some((provider: any) => {
    return provider.metadata?.supportedFeatures?.[feature] === true;
  });
};

// Get all banks with filtering
export const getBanks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const filters = {
      provider: req.query.provider as string,
      paymentMethod: req.query.paymentMethod as string,
      search: req.query.search as string
    };
    
    const result = await bankService.getBanks(filters, page, limit);
    
    // Simplify the response for clients
    const simplifiedBanks = result.banks.map(simplifyBankData);
    
    res.status(200).json({
      success: true,
      data: {
        banks: simplifiedBanks,
        pagination: result.pagination
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get a specific bank
export const getBank = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const bank = await bankService.getBank(id);
    
    // Simplify the response for clients
    const simplifiedBank = simplifyBankData(bank);
    
    res.status(200).json({
      success: true,
      data: { bank: simplifiedBank }
    });
  } catch (error) {
    next(error);
  }
};

// Get supported providers
export const getSupportedProviders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const providers = bankService.getSupportedProviders();
    
    res.status(200).json({
      success: true,
      data: { providers }
    });
  } catch (error) {
    next(error);
  }
};

// Admin endpoint to manually sync banks from providers
export const syncBanks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure this is an admin
    if ((req as any).user.role !== 'admin' && (req as any).user.role !== 'superadmin') {
      return next(createError('Admin access required', 403));
    }
    
    const providers = req.query.provider 
      ? [req.query.provider as string] 
      : undefined;
    
    // Start the sync process (can be done asynchronously for large datasets)
    const syncPromise = bankService.syncBanksFromProviders(providers);
    
    // For immediate feedback, we'll wait for the result
    const result = await syncPromise;
    
    res.status(200).json({
      success: true,
      message: 'Bank synchronization completed',
      data: result
    });
  } catch (error) {
    next(error);
  }
};
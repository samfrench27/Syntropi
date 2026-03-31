// apps/api/src/controllers/public/stubbed-bank.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as stubbedBankService from '../../services/stubbed-bank.service';
import { createError } from '../../middleware/errorHandler';

// Get all banks with filtering
export const getBanks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const filters = {
      country: req.query.country as string,
      provider: req.query.provider as string,
      paymentMethod: req.query.paymentMethod as string,
      search: req.query.search as string
    };
    
    const result = await stubbedBankService.getBanks(filters, page, limit);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Get a specific bank
export const getBank = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    const bank = await stubbedBankService.getBank(id);
    
    res.status(200).json({
      success: true,
      data: { bank }
    });
  } catch (error) {
    next(error);
  }
};

// Get supported providers
export const getSupportedProviders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const providers = stubbedBankService.getSupportedProviders();
    
    res.status(200).json({
      success: true,
      data: { providers }
    });
  } catch (error) {
    next(error);
  }
};

// Admin endpoint to manually sync banks from providers (simulation)
export const syncBanks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure this is an admin
    if ((req as any).user.role !== 'admin' && (req as any).user.role !== 'superadmin') {
      return next(createError('Admin access required', 403));
    }
    
    const providers = req.query.provider 
      ? [req.query.provider as string] 
      : undefined;
    
    // Start the sync process
    const result = await stubbedBankService.syncBanksFromProviders(providers);
    
    res.status(200).json({
      success: true,
      message: 'Bank synchronization completed',
      data: result
    });
  } catch (error) {
    next(error);
  }
};
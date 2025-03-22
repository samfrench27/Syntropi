// apps/api/src/tasks/bank-sync.task.ts
import * as bankService from '../services/bank.service';
import winstonLogger from '../utils/logger';

// Schedule bank sync once a day
export const scheduleBankSync = () => {
  // Simple version - in production you'd use a proper scheduler like node-cron
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  
  const syncAllBanks = async () => {
    try {
      logger.info('Starting scheduled bank sync...');
      const result = await bankService.syncBanksFromProviders();
      logger.info('Scheduled bank sync completed', result);
    } catch (error) {
      logger.error('Error in scheduled bank sync:', error);
    }
    
    // Schedule next run
    setTimeout(syncAllBanks, TWENTY_FOUR_HOURS);
  };
  
  // Start the first run
  setTimeout(syncAllBanks, 1000); // Start 1 second after server initialization
  
  logger.info('Bank sync scheduler initialized');
};
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { syncBanksFromProviders } from '../services/bank.service';
import { winstonLogger as logger } from '../utils/logger';

// Load environment variables
dotenv.config();

async function main() {
  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/syntropi';
  
  try {
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');
    
    // Extract provider argument if provided
    const args = process.argv.slice(2);
    const provider = args.length > 0 ? args[0] : undefined;
    const providers = provider ? [provider] : undefined;
    
    logger.info(`Starting bank sync${provider ? ` for provider: ${provider}` : ''}...`);
    
    // Run the sync
    const result = await syncBanksFromProviders(providers);
    
    logger.info('Bank sync completed:', result);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
    
    // Exit successfully
    process.exit(0);
  } catch (error) {
    logger.error('Error in bank sync task:', error);
    
    // Try to disconnect from MongoDB
    try {
      await mongoose.disconnect();
      logger.info('Disconnected from MongoDB');
    } catch (disconnectError) {
      logger.error('Error disconnecting from MongoDB:', disconnectError);
    }
    
    // Exit with error
    process.exit(1);
  }
}

// Run the script
main(); 
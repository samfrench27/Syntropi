import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger as loggerMiddleware } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { winstonLogger } from './utils/logger';
import { syncBanksFromProviders, cleanupNonGBBanks } from './services/bank.service';

// Import routes
import adminAuthRoutes from './routes/admin/auth.routes';
import adminUserRoutes from './routes/admin/user.routes';
import adminOrgRoutes from './routes/admin/organization.routes';
import adminApiKeyRoutes from './routes/admin/apiKey.routes';
import adminActivityRoutes from './routes/admin/activity.routes';
import adminProviderRoutes from './routes/admin/provider.routes';
import clientAuthRoutes from './routes/client/auth.routes';
import clientApiKeyRoutes from './routes/client/apiKey.routes';
import clientOrganizationRoutes from './routes/client/organization.routes';
import clientActivityRoutes from './routes/client/activity.routes';
import bankRoutes from './routes/public/bank.routes'; // Using real bank routes

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/syntropi';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(loggerMiddleware);

// Routes
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/organizations', adminOrgRoutes);
app.use('/api/admin/api-keys', adminApiKeyRoutes);
app.use('/api/admin/activities', adminActivityRoutes);
app.use('/api/admin/providers', adminProviderRoutes);
app.use('/api/client/auth', clientAuthRoutes);
app.use('/api/client/api-keys', clientApiKeyRoutes);
app.use('/api/client/organization', clientOrganizationRoutes);
app.use('/api/client/activities', clientActivityRoutes);
app.use('/api/banks', bankRoutes); // Using real bank routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Simple public endpoint for checking API status (no auth required)
app.get('/api/status', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'operational',
      version: process.env.API_VERSION || '1.0.0',
      timestamp: new Date()
    }
  });
});

// Error handler (should be last)
app.use(errorHandler);

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    app.listen(PORT, async () => {
      console.log(`Server running on port ${PORT}`);
      
      // First clean up any non-GB banks
      try {
        winstonLogger.info('Starting cleanup of non-GB banks...');
        const deleteCount = await cleanupNonGBBanks();
        winstonLogger.info(`Cleaned up ${deleteCount} non-GB banks`);
      } catch (cleanupError) {
        winstonLogger.error('Error cleaning up non-GB banks:', cleanupError);
      }
      
      // Auto-sync banks on server start - only for token provider to limit load
      try {
        winstonLogger.info('Starting automatic bank sync for token provider...');
        const result = await syncBanksFromProviders(['token']);
        winstonLogger.info('Automatic bank sync completed:', result);
      } catch (error) {
        winstonLogger.error('Error in automatic bank sync:', error);
      }
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB', error);
    process.exit(1);
  }
};

startServer();
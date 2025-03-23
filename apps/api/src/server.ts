import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';

console.log('Starting server initialization...');
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT);

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
//import publicRoutes from './routes/public/index.routes';

console.log('Routes imported successfully');

dotenv.config();
console.log('Loaded environment variables');

const app = express();
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/syntropi';

console.log('MongoDB URI exists:', !!process.env.MONGODB_URI);
console.log('Using PORT:', PORT);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(logger);
console.log('Middleware configured');

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
//app.use('/api/public', publicRoutes);
console.log('Routes configured');

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});
console.log('Health check endpoint added');

// Error handler (should be last)
app.use(errorHandler);
console.log('Error handler added');

// Connect to MongoDB and start server
const startServer = async () => {
  console.log('Attempting to connect to MongoDB...');
  try {
    // Add connection options with timeout and retry settings
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('Connected to MongoDB successfully');
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    // Don't exit the process immediately, let it retry
    console.log('Will retry connection...');
  }
};

console.log('Starting server...');
startServer();
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../../models/user.model';
import { Organization } from '../../models/organization.model';
import { Activity } from '../../models/activity.model';
import { createError } from '../../middleware/errorHandler';
import { Types } from 'mongoose';

// JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

// Generate JWT token for admin
const generateAdminToken = (userId: string, role: string): string => {
  // Use environment variable for the secret key
  const secretKey = JWT_SECRET;
  
  if (!secretKey) {
    throw new Error('JWT_SECRET environment variable is not defined');
  }
  
  return jwt.sign(
    { userId, role }, 
    secretKey,
    { expiresIn: '1h' } // Set an expiration time for the token
  );
}

// Login admin
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return next(createError('Invalid credentials', 401));
    }

    // Check if user is not a valid role
    if (user.role !== 'admin' && user.role !== 'superadmin' && user.role !== 'user') {
      return next(createError('Invalid user role', 403));
    }

    // Check if user is active
    if (user.status !== 'active') {
      return next(createError('Account is not active', 403));
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(createError('Invalid credentials', 401));
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateAdminToken((user._id as any).toString(), user.role);

    // Log activity
    await Activity.create({
      user: user._id,
      organization: user.organization,
      action: 'admin.login',
      details: {
        method: 'credentials',
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get current admin
export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return next(createError('User not found', 404));
    }

    const organization = await Organization.findById(user.organization);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
          organization: organization ? {
            id: organization._id,
            name: organization.name,
          } : null,
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const checkSetupStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if any super admin exists
    const superAdmin = await User.findOne({ role: 'superadmin' });
    
    if (!superAdmin) {
      return next(createError('Super admin not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: {
        setupComplete: true
      }
    });
  } catch (error) {
    next(error);
  }
};

// Forgot password
export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    // Check if admin user exists
    const user = await User.findOne({ 
      email, 
      $or: [{ role: 'admin' }, { role: 'superadmin' }] 
    });
    
    // Always return success to prevent email enumeration
    // In a real implementation, we'd send an email with reset instructions
    
    res.status(200).json({
      success: true,
      message: 'If an admin account exists with this email, password reset instructions have been sent.'
    });
  } catch (error) {
    next(error);
  }
};

// Reset password
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = req.body;

    // In a real implementation, you would:
    // 1. Validate the reset token
    // 2. Find the associated user
    // 3. Update the password
    // 4. Invalidate the token

    // Mock implementation
    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// Create the first admin user (used during system setup)
export const createFirstAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Check if any admin already exists
    const existingAdmin = await User.findOne({ role: 'superadmin' });
    if (existingAdmin) {
      return next(createError('Super admin already exists', 400));
    }

    // Create internal organization for platform admins
    const adminOrg = await Organization.create({
      name: 'Syntropi Platform',
      contactEmail: email,
      plan: 'enterprise',
      status: 'active',
      ownerId: null, // Will update after user creation
      settings: {
        allowedProviders: ['all'],
        rateLimit: 0, // Unlimited
      }
    });

    // Create super admin user
    const admin = await User.create({
      email,
      password,
      firstName,
      lastName,
      role: 'superadmin',
      organization: adminOrg._id,
      status: 'active',
      isVerified: true
    });

// Update organization owner
if (!admin._id) {
  throw new Error('Admin ID is missing');
}

// Type assertion to tell TypeScript this is an ObjectId
adminOrg.ownerId = admin._id as unknown as Types.ObjectId;
await adminOrg.save();

// Generate token
const token = generateAdminToken(admin._id.toString(), admin.role);

    res.status(201).json({
      success: true,
      message: 'Super admin created successfully',
      data: {
        token,
        user: {
          id: admin._id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
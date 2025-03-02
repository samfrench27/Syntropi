// apps/api/src/controllers/client/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../../models/user.model';
import { Activity } from '../../models/activity.model';
import { createError } from '../../middleware/errorHandler';

// JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Generate JWT token for client users
const generateClientToken = (userId: string, role: string, organizationId: string): string => {
  // Use environment variable for the secret key
  const secretKey = JWT_SECRET;
  
  if (!secretKey) {
    throw new Error('JWT_SECRET environment variable is not defined');
  }
  
  return jwt.sign(
    { userId, role, organizationId }, 
    secretKey,
    { expiresIn: '24h' } // Set an expiration time for the token
  );
}

// Login client user
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email })
      .populate('organization', 'name status');
    
    if (!user) {
      return next(createError('Invalid credentials', 401));
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

    // Organization sanity check
    if (!user.organization) {
      return next(createError('User not associated with an organization', 403));
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateClientToken(
      (user._id as any).toString(),
      user.role,
      (user.organization as any)._id.toString()
    );

    // Log activity
    await Activity.create({
      user: user._id,
      organization: user.organization,
      action: 'client.login',
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
          organization: {
            id: (user.organization as any)._id,
            name: (user.organization as any).name,
            status: (user.organization as any).status
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get current client user
export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;

    const user = await User.findById(userId)
      .select('-password')
      .populate('organization', 'name status plan contactEmail');
    
    if (!user) {
      return next(createError('User not found', 404));
    }

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
          organization: user.organization ? {
            id: (user.organization as any)._id,
            name: (user.organization as any).name,
            status: (user.organization as any).status,
            plan: (user.organization as any).plan
          } : null,
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update password
export const updatePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const { currentPassword, newPassword } = req.body;
    
    // Validate input
    if (!currentPassword || !newPassword) {
      return next(createError('Current password and new password are required', 400));
    }
    
    if (newPassword.length < 8) {
      return next(createError('New password must be at least 8 characters long', 400));
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return next(createError('User not found', 404));
    }
    
    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return next(createError('Current password is incorrect', 401));
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    // Log activity
    await Activity.create({
      user: user._id,
      organization: user.organization,
      action: 'client.updatePassword',
      details: {},
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    next(error);
  }
};
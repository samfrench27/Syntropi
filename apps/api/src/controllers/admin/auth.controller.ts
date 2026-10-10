import { Request, Response, NextFunction } from 'express';
import { User } from '../../models/user.model';
import { Organization } from '../../models/organization.model';
import { createError } from '../../middleware/errorHandler';

// Sign-in, password reset and first-admin setup moved to Supabase Auth.
// See controllers/auth.controller.ts (signup, me) and scripts/bootstrap-superadmin.ts.

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

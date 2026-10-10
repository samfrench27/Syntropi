// apps/api/src/controllers/client/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import { User } from '../../models/user.model';
import { createError } from '../../middleware/errorHandler';

// Sign-in and password changes moved to Supabase Auth. See controllers/auth.controller.ts.

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

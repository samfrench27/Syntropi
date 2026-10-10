import { Request, Response, NextFunction } from 'express';
import { User } from '../../models/user.model';
import { Organization } from '../../models/organization.model';
import { Activity } from '../../models/activity.model';
import { createError } from '../../middleware/errorHandler';
import { createIdentity, deleteIdentity, setAppMetadata, setIdentityActive } from '../../lib/supabase';

// Get all users (with pagination and filters)
export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    // Process filters
    const filters: any = {};
    
    if (req.query.role) {
      filters.role = req.query.role;
    }
    
    if (req.query.status) {
      filters.status = req.query.status;
    }
    
    if (req.query.organizationId) {
      filters.organization = req.query.organizationId;
    }
    
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      filters.$or = [
        { email: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex }
      ];
    }
    
    // Get users
    const users = await User.find(filters)
      .select('-password')
      .populate('organization', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await User.countDocuments(filters);
    
    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get user by ID
export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id)
      .select('-password')
      .populate('organization', 'name plan status');
    
    if (!user) {
      return next(createError('User not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

// Create new user
export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, role, organizationId } = req.body;
    const adminId = (req as any).user.userId;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(createError('User already exists with this email', 400));
    }
    
    // Check if organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return next(createError('Organization not found', 404));
    }
    
    // Only superadmin can create admin users
    if (role === 'admin' && (req as any).user.role !== 'superadmin') {
      return next(createError('Only super admins can create admin users', 403));
    }
    
    // Create the profile first so its id can go into the Supabase claims
    const user = await User.create({
      email,
      firstName,
      lastName,
      role,
      organization: organizationId,
      createdBy: adminId,
      status: 'active'
    });

    // Then the sign-in identity. With a password the account is ready; without one the user is
    // emailed an invite to set their own.
    try {
      const supabaseId = await createIdentity({
        email,
        password,
        meta: { role, organization_id: String(organizationId), mongo_user_id: String(user._id) },
      });
      user.supabaseId = supabaseId;
      await user.save();
    } catch (identityError) {
      await User.findByIdAndDelete(user._id);
      throw identityError;
    }

    // Log activity
    await Activity.create({
      user: adminId,
      organization: (req as any).user.organizationId,
      action: 'admin.user.create',
      details: {
        userId: user._id,
        email: user.email,
        organizationId
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organization: {
            id: organization._id,
            name: organization.name
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update user
export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, role, status } = req.body;
    const adminId = (req as any).user.userId;
    
    // Find user
    const user = await User.findById(id);
    if (!user) {
      return next(createError('User not found', 404));
    }
    
    // Check permissions
    // Super admin can update anyone
    // Admin can only update non-admin users in their organization
    if ((req as any).user.role !== 'superadmin') {
      if (user.role === 'admin' || user.role === 'superadmin') {
        return next(createError('You cannot update admin users', 403));
      }
      
      if (user.organization.toString() !== (req as any).user.organizationId.toString()) {
        return next(createError('You can only update users in your organization', 403));
      }
    }
    
    // Only superadmin can change role to admin
    if (role === 'admin' && (req as any).user.role !== 'superadmin') {
      return next(createError('Only super admins can assign admin role', 403));
    }
    
    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(role && { role }),
        ...(status && { status })
      },
      { new: true }
    ).select('-password');

    // Keep the Supabase claims and sign-in access in step with the profile
    if (updatedUser?.supabaseId) {
      if (role && role !== user.role) {
        await setAppMetadata(updatedUser.supabaseId, {
          role: updatedUser.role,
          organization_id: String(updatedUser.organization),
          mongo_user_id: String(updatedUser._id),
        });
      }
      if (status && status !== user.status) {
        await setIdentityActive(updatedUser.supabaseId, status === 'active');
      }
    }
    
    // Log activity
    await Activity.create({
      user: adminId,
      organization: (req as any).user.organizationId,
      action: 'admin.user.update',
      details: {
        userId: id,
        updates: req.body
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: { user: updatedUser }
    });
  } catch (error) {
    next(error);
  }
};

// Delete user
export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user.userId;
    
    // Find user
    const user = await User.findById(id);
    if (!user) {
      return next(createError('User not found', 404));
    }
    
    // Check permissions
    // Super admin can delete anyone except other super admins
    // Admin can only delete regular users in their organization
    if (user.role === 'superadmin') {
      return next(createError('Super admin users cannot be deleted', 403));
    }
    
    if ((req as any).user.role !== 'superadmin') {
      if (user.role === 'admin') {
        return next(createError('You cannot delete admin users', 403));
      }
      
      if (user.organization.toString() !== (req as any).user.organizationId.toString()) {
        return next(createError('You can only delete users in your organization', 403));
      }
    }
    
    // Check if user is the owner of an organization
    const organization = await Organization.findOne({ ownerId: id });
    if (organization) {
      return next(createError('Cannot delete user who owns an organization', 400));
    }
    
    // Delete user, and their sign-in identity so the email can be used again
    if (user.supabaseId) {
      await deleteIdentity(user.supabaseId);
    }
    await User.findByIdAndDelete(id);
    
    // Log activity
    await Activity.create({
      user: adminId,
      organization: (req as any).user.organizationId,
      action: 'admin.user.delete',
      details: {
        userId: id,
        email: user.email
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get user activities
export const getUserActivities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    
    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return next(createError('User not found', 404));
    }
    
    // Get activities
    const activities = await Activity.find({ user: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await Activity.countDocuments({ user: id });
    
    res.status(200).json({
      success: true,
      data: {
        activities,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
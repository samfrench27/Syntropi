import { Request, Response, NextFunction } from 'express';
import { User } from '../models/user.model';
import { Organization } from '../models/organization.model';
import { Activity } from '../models/activity.model';
import { createError } from '../middleware/errorHandler';
import { dashboardUrl, getSupabaseAdmin, getSupabaseAnon, setAppMetadata } from '../lib/supabase';
import { winstonLogger as logger } from '../utils/logger';

// Current user, for any signed-in role
export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;

    const user = await User.findById(userId);
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
          organizationId: organization ? organization._id : undefined,
          organization: organization ? { id: organization._id, name: organization.name } : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public signup: creates the company (organization), a Supabase identity and the linked
 * Mongo profile. The new account has no provider access, so it only gets the Mock bank.
 *
 * The response is the same whether or not the email is already registered, so the endpoint
 * cannot be used to find out who has an account.
 */
export const signup = async (req: Request, res: Response, next: NextFunction) => {
  const { password, firstName, lastName, companyName } = req.body;
  const email = String(req.body.email).trim().toLowerCase();

  const respond = (): void => {
    res.status(201).json({
      success: true,
      message: 'Check your email to confirm your account.',
      data: { emailConfirmationRequired: true },
    });
  };

  let supabaseId: string | undefined;
  let organizationId: unknown;
  let userId: unknown;

  try {
    if (await User.exists({ email })) return respond();

    const { data, error } = await getSupabaseAnon().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${dashboardUrl()}/login`,
        data: { first_name: firstName, last_name: lastName },
      },
    });
    if (error) {
      return next(createError(error.message, error.status === 429 ? 429 : 400));
    }
    // An already registered address comes back as a user with no identities
    if (!data.user || !data.user.identities || data.user.identities.length === 0) return respond();
    supabaseId = data.user.id;

    const organization = await Organization.create({
      name: companyName,
      contactEmail: email,
      plan: 'free',
      status: 'active',
    });
    organizationId = organization._id;

    const user = await User.create({
      email,
      firstName,
      lastName,
      role: 'admin',
      organization: organization._id,
      supabaseId,
      status: 'active',
    });
    userId = user._id;

    organization.ownerId = user._id as any;
    await organization.save();

    await setAppMetadata(supabaseId, {
      role: 'admin',
      organization_id: String(organization._id),
      mongo_user_id: String(user._id),
    });

    Activity.create({
      user: user._id,
      organization: organization._id,
      action: 'auth.signup',
      details: { organizationId: organization._id },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    }).catch((e) => logger.warn(`Could not log signup activity: ${e.message}`));

    return respond();
  } catch (error) {
    // Undo whatever was created so a failed signup leaves nothing behind
    if (userId) await User.findByIdAndDelete(userId).catch(() => undefined);
    if (organizationId) await Organization.findByIdAndDelete(organizationId).catch(() => undefined);
    if (supabaseId) await getSupabaseAdmin().auth.admin.deleteUser(supabaseId).catch(() => undefined);
    next(error);
  }
};

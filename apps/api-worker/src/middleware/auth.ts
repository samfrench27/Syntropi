import type { MiddlewareHandler } from 'hono';
import { jwtVerify } from 'jose';
import { ApiError } from '../http';
import type { AppDeps, AppEnv, Role } from '../types';
import type { AppMetadata } from '../identity';

const ROLES: Role[] = ['superadmin', 'admin', 'user'];

/**
 * Verify a Supabase access token and return its trusted claims. Signature, issuer, audience and
 * expiry are checked. Only app_metadata is trusted for authorisation: user_metadata can be edited
 * by the user.
 */
export async function verifyAccessToken(deps: AppDeps, token: string) {
  const { payload } = await jwtVerify(token, deps.jwks, {
    issuer: `${deps.config.supabaseUrl}/auth/v1`,
    audience: 'authenticated',
  });
  if (!payload.sub) throw new Error('Token has no subject');
  return { sub: payload.sub, meta: (payload.app_metadata as AppMetadata) || {} };
}

/** Sign-in required. Sets c.var.user. */
export const authenticate: MiddlewareHandler<AppEnv> = async (c, next) => {
  const deps = c.get('deps');
  const header = c.req.header('authorization');
  if (!header?.startsWith('Bearer ')) throw new ApiError('Authentication required', 401);

  let claims;
  try {
    claims = await verifyAccessToken(deps, header.slice(7));
  } catch {
    throw new ApiError('Invalid or expired token', 401);
  }

  // The profile is the check that the account still exists and is active. Its id is the Supabase user id.
  const [profile] = await deps.db.query<{ id: string; email: string; role: Role; status: string; organization_id: string }>(
    `select id, email, role, status, organization_id from profiles where id = $1`,
    [claims.sub],
  );
  if (!profile) throw new ApiError('User not found', 401);
  if (profile.status !== 'active') throw new ApiError('Account is not active', 403);

  const role = claims.meta.role;
  if (!role || !ROLES.includes(role)) throw new ApiError('Account is not fully set up', 403);
  // The role changed after this token was issued: the client should refresh its session
  if (role !== profile.role) throw new ApiError('Session out of date. Refresh and try again.', 401);

  c.set('user', { userId: profile.id, role, organizationId: profile.organization_id, email: profile.email });
  await next();
};

export const authorizeAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const role = c.get('user')?.role;
  if (role !== 'admin' && role !== 'superadmin') throw new ApiError('Admin access required', 403);
  await next();
};

export const authorizeSuperAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get('user')?.role !== 'superadmin') throw new ApiError('Super admin access required', 403);
  await next();
};

/** A superadmin passes any role check. */
export const requireRole =
  (required: Role): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const user = c.get('user');
    if (!user) throw new ApiError('Authentication required', 401);
    if (user.role !== required && user.role !== 'superadmin') throw new ApiError(`${required} access required`, 403);
    await next();
  };

/**
 * Tenant guard. Admins and superadmins of other organizations are kept out of an organization's
 * data unless they are superadmin; everyone else is limited to their own organization.
 */
export function canAccessOrganization(user: { role: Role; organizationId: string }, organizationId: string): boolean {
  return user.role === 'superadmin' || user.organizationId === organizationId;
}

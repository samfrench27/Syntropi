import { GoTrueClient } from '@supabase/auth-js';
import { ApiError } from './http';
import type { Role } from './types';

export interface AppMetadata {
  role?: Role;
  organization_id?: string;
}

/**
 * Supabase Auth, as the API uses it: identity only (sign-in is done by the browser against
 * Supabase directly). Replaced by an in-memory version in tests.
 */
export interface Identity {
  /** Register a new account; Supabase emails the confirmation link. */
  signUp(input: { email: string; password: string; redirectTo: string; data?: Record<string, unknown> }): Promise<{ id: string; alreadyRegistered: boolean }>;
  /** Create an account for someone an admin is adding. With a password it is ready to use; without one an invite email is sent. */
  createUser(input: { email: string; password?: string; redirectTo: string; meta: AppMetadata }): Promise<string>;
  setAppMetadata(id: string, meta: AppMetadata): Promise<void>;
  /** Block or allow sign-in. */
  setActive(id: string, active: boolean): Promise<void>;
  deleteUser(id: string): Promise<void>;
}

export function createSupabaseIdentity(
  cfg: { url: string; anonKey: string; serviceRoleKey: string },
  fetchImpl: typeof fetch = fetch,
): Identity {
  const client = (key: string) =>
    new GoTrueClient({
      url: `${cfg.url}/auth/v1`,
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      fetch: fetchImpl,
    });
  const anon = client(cfg.anonKey);
  const admin = client(cfg.serviceRoleKey).admin;

  const fail = (what: string, message: string, status?: number): never => {
    throw new ApiError(status === 429 ? message : `${what}: ${message}`, status === 429 ? 429 : 400);
  };

  return {
    async signUp({ email, password, redirectTo, data }) {
      const { data: result, error } = await anon.signUp({ email, password, options: { emailRedirectTo: redirectTo, data } });
      if (error) throw new ApiError(error.message, error.status === 429 ? 429 : 400);
      // An address that is already registered comes back as a user with no identities
      if (!result.user || !result.user.identities || result.user.identities.length === 0) {
        return { id: result.user?.id ?? '', alreadyRegistered: true };
      }
      return { id: result.user.id, alreadyRegistered: false };
    },

    async createUser({ email, password, redirectTo, meta }) {
      if (password) {
        const { data, error } = await admin.createUser({ email, password, email_confirm: true, app_metadata: meta });
        if (error || !data.user) return fail('Could not create user', error?.message ?? 'unknown error', error?.status);
        return data.user.id;
      }
      const { data, error } = await admin.inviteUserByEmail(email, { redirectTo });
      if (error || !data.user) return fail('Could not invite user', error?.message ?? 'unknown error', error?.status);
      const update = await admin.updateUserById(data.user.id, { app_metadata: meta });
      if (update.error) fail('Could not set user role', update.error.message);
      return data.user.id;
    },

    async setAppMetadata(id, meta) {
      const { error } = await admin.updateUserById(id, { app_metadata: meta });
      if (error) fail('Could not update user', error.message);
    },

    async setActive(id, active) {
      const { error } = await admin.updateUserById(id, { ban_duration: active ? 'none' : '876000h' });
      if (error) fail('Could not update user', error.message);
    },

    async deleteUser(id) {
      const { error } = await admin.deleteUser(id);
      if (error) fail('Could not delete user', error.message);
    },
  };
}

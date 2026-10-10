import { GoTrueClient } from '@supabase/auth-js';
import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';

/**
 * Supabase is used for identity only: signup, sign-in, password reset and sessions.
 * Orgs, roles-as-data, API keys, payments and provider access stay in MongoDB.
 */

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Fail fast at startup with a clear message instead of on the first sign-in. */
export function assertSupabaseConfigured(): void {
  ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].forEach(env);
}

/** Only the Auth API is used, so the lightweight auth client is enough (no realtime, storage or database clients). */
interface AuthOnlyClient {
  auth: GoTrueClient;
}

function authClient(key: string): AuthOnlyClient {
  return {
    auth: new GoTrueClient({
      url: `${env('SUPABASE_URL')}/auth/v1`,
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    }),
  };
}

let admin: AuthOnlyClient | undefined;
let anon: AuthOnlyClient | undefined;

/** Service-role client. Server only: it bypasses all access rules. */
export function getSupabaseAdmin(): AuthOnlyClient {
  admin ??= authClient(env('SUPABASE_SERVICE_ROLE_KEY'));
  return admin;
}

/** Anon client, used for flows that should behave like a browser (signup sends the email). */
export function getSupabaseAnon(): AuthOnlyClient {
  anon ??= authClient(env('SUPABASE_ANON_KEY'));
  return anon;
}

export const supabaseIssuer = () => `${env('SUPABASE_URL')}/auth/v1`;

let jwks: JWTVerifyGetKey | undefined;

/** Public signing keys, fetched once and cached by jose. */
export function getJwks(): JWTVerifyGetKey {
  jwks ??= createRemoteJWKSet(new URL(`${supabaseIssuer()}/.well-known/jwks.json`));
  return jwks;
}

/** Tests inject a local key set so no network is needed. */
export function setJwksForTesting(keys: JWTVerifyGetKey | undefined): void {
  jwks = keys;
}

export const dashboardUrl = () => process.env.DASHBOARD_URL || 'http://localhost:3000';

export type AppRole = 'superadmin' | 'admin' | 'user';

export interface AppMetadata {
  role?: AppRole;
  organization_id?: string;
  mongo_user_id?: string;
}

/** Write the trusted claims. app_metadata can only be changed with the service role key. */
export async function setAppMetadata(supabaseId: string, meta: AppMetadata): Promise<void> {
  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(supabaseId, { app_metadata: meta });
  if (error) throw new Error(`Could not update Supabase user: ${error.message}`);
}

interface CreateIdentityInput {
  email: string;
  /** If given, the account is created with this password and no email is sent. Otherwise an invite email is sent. */
  password?: string;
  meta: AppMetadata;
}

/** Create the Supabase identity for a user an admin is adding. Returns the Supabase user id. */
export async function createIdentity({ email, password, meta }: CreateIdentityInput): Promise<string> {
  const adminAuth = getSupabaseAdmin().auth.admin;
  if (password) {
    const { data, error } = await adminAuth.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: meta,
    });
    if (error || !data.user) throw new Error(`Could not create Supabase user: ${error?.message}`);
    return data.user.id;
  }
  const { data, error } = await adminAuth.inviteUserByEmail(email, {
    redirectTo: `${dashboardUrl()}/reset-password`,
  });
  if (error || !data.user) throw new Error(`Could not invite Supabase user: ${error?.message}`);
  await setAppMetadata(data.user.id, meta);
  return data.user.id;
}

/** Block or allow sign-in for an account. Sessions stop refreshing once banned. */
export async function setIdentityActive(supabaseId: string, active: boolean): Promise<void> {
  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(supabaseId, {
    ban_duration: active ? 'none' : '876000h',
  });
  if (error) throw new Error(`Could not update Supabase user: ${error.message}`);
}

export async function deleteIdentity(supabaseId: string): Promise<void> {
  const { error } = await getSupabaseAdmin().auth.admin.deleteUser(supabaseId);
  if (error) throw new Error(`Could not delete Supabase user: ${error.message}`);
}

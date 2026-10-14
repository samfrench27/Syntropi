import { GoTrueClient } from '@supabase/auth-js';
import { setAuthToken } from './auth';

/**
 * Browser auth client for Supabase (identity only). The session is kept in localStorage and
 * refreshed automatically. Only the public anon key is used here.
 *
 * The lightweight auth client is used instead of the full supabase-js client because the
 * dashboard never uses realtime, storage or direct database access.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const inBrowser = typeof window !== 'undefined';

export const supabaseAuth = new GoTrueClient({
  url: `${url}/auth/v1`,
  headers: { apikey: anonKey || '', Authorization: `Bearer ${anonKey || ''}` },
  storageKey: 'syntropi-auth',
  persistSession: inBrowser,
  autoRefreshToken: inBrowser,
  // Email confirmation and password reset links land here with the session in the URL
  detectSessionInUrl: inBrowser,
});

/**
 * A current access token for API calls. Refreshes the session first if it is about to expire,
 * which also covers a tab that has been asleep.
 */
export async function getFreshToken(): Promise<string | null> {
  const { data } = await supabaseAuth.getSession();
  const token = data.session?.access_token ?? null;
  if (token) setAuthToken(token);
  return token;
}

/** Sign-in errors in plain language. */
export function describeAuthError(error: { message: string; code?: string }): string {
  if (error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message)) {
    return 'Confirm your email first. Check your inbox for the link we sent.';
  }
  if (error.code === 'invalid_credentials' || /invalid login/i.test(error.message)) {
    return 'That email and password don’t match. Check them and try again.';
  }
  if (error.code === 'weak_password' || /password (should|must)|weak password/i.test(error.message)) {
    return 'That password isn’t strong enough. Use at least 12 characters with upper and lower case letters and a number, and avoid common passwords.';
  }
  if (error.code === 'same_password' || /different from the old/i.test(error.message)) {
    return 'Choose a password you haven’t used before for this account.';
  }
  if (/rate limit|too many/i.test(error.message)) {
    return 'Too many attempts. Wait a few minutes and try again.';
  }
  return error.message;
}
